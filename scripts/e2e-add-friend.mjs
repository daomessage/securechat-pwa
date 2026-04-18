/**
 * 端到端冒烟:派生 Account B(临时助记词) → 注册 → auth → 向 LeoA 发好友请求
 *
 * 用法:
 *   TARGET_ALIAS=uel21oqs6 node scripts/e2e-add-friend.mjs
 *
 * 依赖 PWA 自己的 SDK 符号链接(node_modules/@daomessage_sdk/sdk -> ../../sdk-typescript)
 */

import {
  newMnemonic,
  deriveIdentity,
  toBase64,
} from '@daomessage_sdk/sdk';
import { createHash, createPrivateKey, sign as nodeSign } from 'node:crypto';

// Node 原生 ed25519 需要 DER/PKCS8 包裹后的私钥;把 32B raw seed 套上标准 DER 头
function signEd25519(msg, rawPriv32) {
  // Ed25519 PKCS8 DER 前缀:30 2e 02 01 00 30 05 06 03 2b 65 70 04 22 04 20
  const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const pkcs8 = Buffer.concat([prefix, Buffer.from(rawPriv32)]);
  const key = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  return nodeSign(null, Buffer.from(msg), key);
}

function sha256hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

const API = process.env.API_BASE || 'https://relay.daomessage.com';
const TARGET = process.env.TARGET_ALIAS;
if (!TARGET) {
  console.error('❌ 需要环境变量 TARGET_ALIAS=<对方 alias_id>');
  process.exit(1);
}

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(API + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}

function powSolve(challenge, difficulty) {
  const prefix = '0'.repeat(difficulty || 4);
  for (let i = 0; i < 10_000_000; i++) {
    const candidate = String(i);
    const hex = sha256hex(challenge + candidate);
    if (hex.startsWith(prefix)) return candidate;
  }
  throw new Error('PoW solve failed');
}

(async () => {
  const mnemonic = newMnemonic();
  console.log('🔑 助记词:', mnemonic);

  const ident = deriveIdentity(mnemonic);
  const ed25519 = toBase64(ident.signingKey.publicKey);
  const x25519  = toBase64(ident.ecdhKey.publicKey);
  console.log('🆔 ed25519 pub:', ed25519.slice(0, 24) + '...');

  // 1) PoW
  console.log('⚙️  请求 PoW 挑战...');
  const pow = await post('/api/v1/pow/challenge', {});
  if (pow.status !== 200) { console.error('PoW challenge 失败', pow); process.exit(2); }
  const nonce = powSolve(pow.data.challenge_string, pow.data.difficulty);
  console.log('⚙️  PoW 求解:', nonce);

  // 2) register
  console.log('📝 注册账号 B...');
  const reg = await post('/api/v1/register', {
    ed25519_public_key: ed25519,
    x25519_public_key: x25519,
    nickname: 'LeoB_' + Math.random().toString(36).slice(2, 6),
    pow_nonce: nonce,
  });
  if (reg.status !== 200 && reg.status !== 201) { console.error('register 失败', reg); process.exit(3); }
  const { uuid, alias_id: aliasId } = reg.data;
  console.log('✅ 注册成功. uuid:', uuid, ' aliasId:', aliasId);

  // 3) auth challenge
  console.log('🔐 获取 auth challenge...');
  const ch = await post('/api/v1/auth/challenge', { user_uuid: uuid });
  if (ch.status !== 200) { console.error('auth challenge 失败', ch); process.exit(4); }
  const sig = signEd25519(new TextEncoder().encode(ch.data.challenge), ident.signingKey.privateKey);
  const sigB64 = toBase64(new Uint8Array(sig));

  // 4) auth verify
  const vf = await post('/api/v1/auth/verify', {
    user_uuid: uuid,
    challenge: ch.data.challenge,
    signature: sigB64,
  });
  if (vf.status !== 200) { console.error('auth verify 失败', vf); process.exit(5); }
  const token = vf.data.token;
  console.log('✅ 获得 JWT:', token.slice(0, 20) + '...');

  // 5) 向 TARGET 发好友请求
  console.log(`🤝 向 ${TARGET} 发起好友请求...`);
  const fr = await post('/api/v1/friends/request', { to_alias_id: TARGET }, token);
  console.log('结果:', fr.status, fr.data);

  console.log('\n========== 账号 B 信息 ==========');
  console.log('alias_id  =', aliasId);
  console.log('mnemonic  =', mnemonic);
  console.log('=================================\n');
})().catch(e => { console.error('❌', e); process.exit(99); });

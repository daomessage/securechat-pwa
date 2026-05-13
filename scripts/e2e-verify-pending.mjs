/**
 * 用账号 B 的 JWT 拉好友列表,验证 pending(direction=sent)存在
 *
 * 用法:
 *   MNEMONIC="..." node scripts/e2e-verify-pending.mjs
 */

import { deriveIdentity, toBase64 } from '@daomessage_sdk/sdk';
import { createPrivateKey, sign as nodeSign } from 'node:crypto';

const API = process.env.API_BASE || 'https://relay.daomessage.com';
const MNEMONIC = process.env.MNEMONIC;
if (!MNEMONIC) {
  console.error('❌ 需要 MNEMONIC 环境变量');
  process.exit(1);
}

function signEd25519(msg, rawPriv32) {
  const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const pkcs8 = Buffer.concat([prefix, Buffer.from(rawPriv32)]);
  const key = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  return nodeSign(null, Buffer.from(msg), key);
}

async function post(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json().catch(() => null) };
}

(async () => {
  const ident = deriveIdentity(MNEMONIC);
  const ed = toBase64(ident.signingKey.publicKey);
  const x  = toBase64(ident.ecdhKey.publicKey);

  // 这个账号已经注册过,register 会 409 返回 uuid
  const reg = await post('/api/v1/register', {
    ed25519_public_key: ed, x25519_public_key: x, nickname: 'LeoB_recover'
  });
  let uuid;
  if (reg.status === 409) uuid = reg.data?.uuid;
  else if (reg.status === 200 || reg.status === 201) uuid = reg.data.uuid;
  else { console.error('register unexpected', reg); process.exit(2); }
  console.log('uuid:', uuid);

  const ch = await post('/api/v1/auth/challenge', { user_uuid: uuid });
  const sig = signEd25519(new TextEncoder().encode(ch.data.challenge), ident.signingKey.privateKey);
  const vf = await post('/api/v1/auth/verify', {
    user_uuid: uuid, challenge: ch.data.challenge, signature: toBase64(new Uint8Array(sig))
  });
  const token = vf.data.token;
  console.log('JWT ok');

  const list = await fetch(API + '/api/v1/friends', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const friends = await list.json();
  console.log('\n=== 好友列表 (账号 B 视角) ===');
  console.log(JSON.stringify(friends, null, 2));
})();

/**
 * 端到端测试伴侣脚本:扮演"账号 C",配合 Android 账号 B 走完整链路。
 *
 * 用法:
 *   node scripts/e2e-companion.mjs register     # 创建账号 C,输出 alias/mnemonic
 *   node scripts/e2e-companion.mjs accept <MNEMONIC>   # 账号 C 接受所有 pending 好友请求
 *   node scripts/e2e-companion.mjs listen <MNEMONIC>   # 账号 C 连 WS,打印收到的消息
 *   node scripts/e2e-companion.mjs send <MNEMONIC> <TO_ALIAS> <TEXT>   # 账号 C 发消息
 */

import {
  newMnemonic,
  deriveIdentity,
  toBase64,
  fromBase64,
} from '@daomessage_sdk/sdk';
// X25519 ECDH 的 getSharedSecret 直接用 noble(SDK 内部也是用它)
import { x25519 } from '@noble/curves/ed25519';

function computeSharedSecret(myPriv, theirPub) {
  return x25519.getSharedSecret(myPriv, theirPub);
}
import { createHash, createPrivateKey, sign as nodeSign, randomBytes, createCipheriv, createDecipheriv, hkdfSync } from 'node:crypto';
// Node 22+ 原生 WebSocket

const API = 'https://relay.daomessage.com';

// ── utilities ──────────────────────────────────────────────────
function sha256hex(s) { return createHash('sha256').update(s).digest('hex'); }

function signEd25519(msg, rawPriv32) {
  const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const pkcs8 = Buffer.concat([prefix, Buffer.from(rawPriv32)]);
  const key = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  return nodeSign(null, Buffer.from(msg), key);
}

function powSolve(challenge, difficulty) {
  const prefix = '0'.repeat(difficulty || 4);
  for (let i = 0; i < 10_000_000; i++) {
    if (sha256hex(challenge + i).startsWith(prefix)) return String(i);
  }
  throw new Error('PoW solve timeout');
}

async function api(method, path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  const r = await fetch(API + path, {
    method, headers: h, body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let data; try { data = JSON.parse(txt); } catch { data = txt; }
  return { status: r.status, data };
}

async function authenticate(mnemonic) {
  const ident = deriveIdentity(mnemonic);
  const ed = toBase64(ident.signingKey.publicKey);
  const x  = toBase64(ident.ecdhKey.publicKey);

  // 先 register(可能 409)
  const powCh = await api('POST', '/api/v1/pow/challenge', {});
  const nonce = powSolve(powCh.data.challenge_string, powCh.data.difficulty);
  const reg = await api('POST', '/api/v1/register', {
    ed25519_public_key: ed,
    x25519_public_key: x,
    nickname: 'Companion',
    pow_nonce: nonce,
  });

  let uuid, aliasId;
  if (reg.status === 409) {
    uuid = reg.data.uuid;
    aliasId = reg.data.alias_id;
  } else if (reg.status === 200 || reg.status === 201) {
    uuid = reg.data.uuid;
    aliasId = reg.data.alias_id;
  } else {
    throw new Error(`register ${reg.status}: ${JSON.stringify(reg.data)}`);
  }

  const ch = await api('POST', '/api/v1/auth/challenge', { user_uuid: uuid });
  const sig = signEd25519(new TextEncoder().encode(ch.data.challenge), ident.signingKey.privateKey);
  const vf = await api('POST', '/api/v1/auth/verify', {
    user_uuid: uuid,
    challenge: ch.data.challenge,
    signature: toBase64(new Uint8Array(sig)),
  });
  if (vf.status !== 200) throw new Error(`auth/verify ${vf.status}: ${JSON.stringify(vf.data)}`);

  return { uuid, aliasId, token: vf.data.token, ident, mnemonic };
}

// ── sub-commands ────────────────────────────────────────────────

async function cmdRegister() {
  const mnemonic = newMnemonic();
  const acc = await authenticate(mnemonic);
  console.log(`\n✅ 账号 C 已创建`);
  console.log(`  alias:    ${acc.aliasId}`);
  console.log(`  uuid:     ${acc.uuid}`);
  console.log(`  mnemonic: ${acc.mnemonic}\n`);
  console.log(`【保存 mnemonic!后续命令需要它】`);
}

async function cmdAccept(mnemonic) {
  const acc = await authenticate(mnemonic);
  console.log(`C = ${acc.aliasId}`);

  const list = await fetch(API + '/api/v1/friends', {
    headers: { Authorization: `Bearer ${acc.token}` },
  });
  const friends = await list.json();
  console.log(`\n当前好友列表(${friends.length}):`);
  for (const f of friends) {
    console.log(`  #${f.friendship_id} ${f.direction}/${f.status}  ${f.alias_id}  "${f.nickname}"`);
  }
  const pending = friends.filter(f => f.status === 'pending' && f.direction === 'received');
  if (pending.length === 0) {
    console.log('\n⚠️  没有待接受的好友请求');
    return;
  }
  for (const f of pending) {
    console.log(`\n接受 #${f.friendship_id} 来自 ${f.alias_id}...`);
    const r = await api('PUT', `/api/v1/friends/${f.friendship_id}/accept`, {}, acc.token);
    console.log(`  HTTP ${r.status} ${JSON.stringify(r.data)}`);
  }
}

async function cmdListen(mnemonic) {
  const acc = await authenticate(mnemonic);
  console.log(`C = ${acc.aliasId},监听中...\n`);
  const wsUrl = `${API.replace('https:', 'wss:')}/ws?user_uuid=${acc.uuid}&token=${acc.token}`;
  const ws = new WebSocket(wsUrl);
  ws.addEventListener('open', () => console.log('🔗 WS connected'));
  ws.addEventListener('message', (ev) => {
    try {
      const m = JSON.parse(ev.data);
      console.log(`📨`, m);
    } catch {
      console.log('raw:', ev.data);
    }
  });
  ws.addEventListener('close', (ev) => console.log(`✖  WS closed (code=${ev.code})`));
  ws.addEventListener('error', (ev) => console.log('❌ WS error', ev));
  // 保持连接
  await new Promise(() => {});
}

async function cmdSend(mnemonic, toAlias, text) {
  const acc = await authenticate(mnemonic);
  console.log(`C = ${acc.aliasId} → ${toAlias}`);

  // 查对方公钥 + 建立会话
  const profile = await api('GET', `/api/v1/users/${toAlias}`, null, acc.token);
  if (profile.status !== 200) throw new Error(`user ${toAlias} lookup failed: ${profile.status}`);
  const theirX = fromBase64(profile.data.x25519_public_key);

  // 共享密钥 + HKDF
  const shared = computeSharedSecret(acc.ident.ecdhKey.privateKey, theirX);
  const convId = [acc.aliasId, toAlias].sort().join(':'); // 按 alias 字典序作为 convId
  const salt = createHash('sha256').update(convId).digest();
  const info = Buffer.from('securechat-session-v1');
  const sessionKey = Buffer.from(hkdfSync('sha256', Buffer.from(shared), salt, info, 32));

  // AES-GCM 加密
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', sessionKey, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ciphertext = toBase64(new Uint8Array(Buffer.concat([iv, enc, tag])));

  // WS 发送
  const wsUrl = `${API.replace('https:', 'wss:')}/ws?user_uuid=${acc.uuid}&token=${acc.token}`;
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  const msgId = 'msg-' + Date.now();
  const frame = {
    type: 'message',
    id: msgId,
    to: toAlias,
    conv_id: convId,
    text: ciphertext,
    time: Date.now(),
  };
  ws.send(JSON.stringify(frame));
  console.log('📤 sent:', frame);
  // 等 ack
  setTimeout(() => { ws.close(); process.exit(0); }, 3000);
  ws.addEventListener('message', (ev) => {
    try { console.log('📨 ack:', JSON.parse(ev.data)); } catch {}
  });
}

// ── main ─────────────────────────────────────────────────────
const cmd = process.argv[2];
if (cmd === 'register') {
  await cmdRegister();
} else if (cmd === 'accept') {
  await cmdAccept(process.argv[3]);
} else if (cmd === 'listen') {
  await cmdListen(process.argv[3]);
} else if (cmd === 'send') {
  await cmdSend(process.argv[3], process.argv[4], process.argv.slice(5).join(' '));
} else {
  console.log(`用法:
  node scripts/e2e-companion.mjs register
  node scripts/e2e-companion.mjs accept <MNEMONIC>
  node scripts/e2e-companion.mjs listen <MNEMONIC>
  node scripts/e2e-companion.mjs send <MNEMONIC> <TO_ALIAS> <TEXT>`);
}

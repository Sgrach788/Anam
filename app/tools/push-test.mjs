// Web Push 纯函数测试：VAPID JWT + RFC8291 加密往返。
import crypto from 'node:crypto';
import { generateVapidKeys, buildVapidJwt, encryptPayload, decryptPayloadForTest } from '../lib/push.mjs';

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

const vapid = generateVapidKeys();
const jwt = buildVapidJwt('https://web.push.apple.com', 'mailto:test@example.com', vapid.privateJwk);
const [header, payload, signature] = jwt.split('.');
const headerJson = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
const payloadJson = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
check('JWT header ES256', headerJson.alg === 'ES256' && headerJson.typ === 'JWT');
check('JWT audience/subject/exp', payloadJson.aud === 'https://web.push.apple.com'
  && payloadJson.sub === 'mailto:test@example.com' && payloadJson.exp > Math.floor(Date.now() / 1000));
const verified = crypto.verify('sha256', Buffer.from(`${header}.${payload}`), {
  key: crypto.createPublicKey({ key: vapid.publicJwk, format: 'jwk' }),
  dsaEncoding: 'ieee-p1363',
}, Buffer.from(signature, 'base64url'));
check('JWT 签名可验证', verified === true);

const receiver = crypto.createECDH('prime256v1');
receiver.generateKeys();
const auth = crypto.randomBytes(16);
const subscription = {
  endpoint: 'https://web.push.apple.com/abc',
  keys: { p256dh: receiver.getPublicKey(null, 'uncompressed').toString('base64url'), auth: auth.toString('base64url') },
};
const payloadText = JSON.stringify({ title: 'Anam', body: '测试推送' });
const body = encryptPayload(subscription, payloadText);
const decrypted = decryptPayloadForTest(receiver.getPrivateKey(), auth, body);
check('加密正文可解回', decrypted.plain === payloadText, decrypted.plain);
check('aes128gcm 记录头', body.length > 21 + 65 && body[20] === 65);
check('payload 长度 ≤ 4096', body.length <= 4096);

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed ? 1 : 0);

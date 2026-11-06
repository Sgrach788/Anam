// Web Push：VAPID JWT + RFC 8291 aes128gcm + RFC 8188 单一记录。
// 只用 Node 内置 crypto/fetch，不引入依赖。
import crypto from 'node:crypto';

const b64u = (value) => Buffer.from(value).toString('base64url');
const fromB64u = (value) => Buffer.from(String(value || ''), 'base64url');

export function generateVapidKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const publicJwk = publicKey.export({ format: 'jwk' });
  const privateJwk = privateKey.export({ format: 'jwk' });
  const rawPublic = Buffer.concat([
    Buffer.from([4]),
    fromB64u(publicJwk.x),
    fromB64u(publicJwk.y),
  ]);
  return { publicJwk, privateJwk, publicKey: b64u(rawPublic) };
}

export function buildVapidJwt(audience, subject, privateKeyJwk, now = Date.now(), ttlSeconds = 12 * 3600) {
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: String(audience).replace(/\/+$/, ''),
    exp: Math.floor(now / 1000) + Math.max(60, Number(ttlSeconds) || 12 * 3600),
    sub: String(subject || 'mailto:anam@localhost'),
  };
  const input = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`;
  const key = crypto.createPrivateKey({ key: privateKeyJwk, format: 'jwk' });
  const signature = crypto.sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
  return `${input}.${b64u(signature)}`;
}

function hkdf(ikm, salt, info, length) {
  return Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, length));
}

export function encryptPayload(subscription, plaintext) {
  const uaPublic = fromB64u(subscription?.keys?.p256dh);
  const authSecret = fromB64u(subscription?.keys?.auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error('invalid_subscription_keys');
  if (Buffer.byteLength(plaintext) > 3990) throw new Error('payload_too_large');

  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(null, 'uncompressed');
  const ecdhSecret = ecdh.computeSecret(uaPublic);
  const salt = crypto.randomBytes(16);

  const authInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const prk = hkdf(ecdhSecret, authSecret, authInfo, 32);
  const cek = hkdf(prk, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(prk, salt, Buffer.from('Content-Encoding: nonce\0'), 12);

  const plain = Buffer.concat([Buffer.from(plaintext, 'utf8'), Buffer.from([2])]);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  return Buffer.concat([salt, recordSize, Buffer.from([asPublic.length]), asPublic, encrypted]);
}

export function decryptPayloadForTest(subscriptionPrivateKey, authSecret, body) {
  const buffer = Buffer.from(body);
  const salt = buffer.subarray(0, 16);
  const recordSize = buffer.readUInt32BE(16);
  const idLength = buffer[20];
  const asPublic = buffer.subarray(21, 21 + idLength);
  const encrypted = buffer.subarray(21 + idLength);
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(subscriptionPrivateKey);
  const uaPublic = ecdh.getPublicKey(null, 'uncompressed');
  const ecdhSecret = ecdh.computeSecret(asPublic);
  const authInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const prk = hkdf(ecdhSecret, authSecret, authInfo, 32);
  const cek = hkdf(prk, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(prk, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const ciphertext = encrypted.subarray(0, -16);
  const tag = encrypted.subarray(-16);
  const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return { plain: plain.subarray(0, -1).toString('utf8'), recordSize, salt };
}

export async function sendPush(subscription, payload, { privateKeyJwk, publicKey, subject = 'mailto:anam@localhost' } = {}) {
  const endpoint = subscription?.endpoint;
  if (!endpoint) throw new Error('missing_endpoint');
  if (!privateKeyJwk || !publicKey) throw new Error('push_not_configured');
  const audience = new URL(endpoint).origin;
  const jwt = buildVapidJwt(audience, subject, privateKeyJwk);
  const body = encryptPayload(subscription, JSON.stringify(payload));
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal',
    },
    body,
  });
  return { ok: response.ok, status: response.status };
}

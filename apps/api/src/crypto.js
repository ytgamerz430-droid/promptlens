import crypto from 'node:crypto';

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
if (!process.env.SESSION_SECRET) {
  console.warn('[crypto] SESSION_SECRET is not set; using an insecure dev default. Set it in production.');
}
// Derive a fixed 32-byte key from the session secret (AES-256).
const KEY = crypto.createHash('sha256').update(SECRET, 'utf8').digest();

/** AES-256-GCM encrypt. Returns "iv.ct.tag" (base64url parts). */
export function encrypt(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${ct.toString('base64url')}.${tag.toString('base64url')}`;
}

/** Decrypt a payload produced by encrypt(). Throws on tampering. */
export function decrypt(payload) {
  const [ivB64, ctB64, tagB64] = String(payload).split('.');
  if (!ivB64 || !ctB64 || !tagB64) throw new Error('Malformed encrypted payload');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]);
  return pt.toString('utf8');
}

/** Random prefixed id, e.g. u_..., job_..., up_..., batch_... */
export function newId(prefix) {
  return `${prefix}${crypto.randomBytes(9).toString('base64url')}`;
}

/** Cryptographically random hex token (password resets, oauth state). */
export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Short human-friendly referral code, e.g. "K7QX2M". */
export function referralCode() {
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (const b of bytes) out += REFERRAL_ALPHABET[b % REFERRAL_ALPHABET.length];
  return out;
}

export function maskKey(apiKey) {
  if (!apiKey) return null;
  const tail = apiKey.slice(-4);
  return `••••${tail}`;
}

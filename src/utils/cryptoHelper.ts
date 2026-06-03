import crypto from "crypto";

const ENCRYPTION_KEY_ENV = "TOTP_ENCRYPTION_KEY";

function getEncryptionKey(): Buffer {
  const key = process.env[ENCRYPTION_KEY_ENV];
  if (!key || key.length < 32) {
    throw new Error(`${ENCRYPTION_KEY_ENV} env var must be set and at least 32 chars`);
  }
  return Buffer.from(key.slice(0, 32), "utf8");
}

export const encrypt = (plaintext: string): string => {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
};

export const decrypt = (ciphertext: string): string => {
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};

// TOTP (RFC 6238) implementation using native crypto
export const generateTotpSecret = (): string => {
  const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = crypto.randomBytes(20);
  let result = "";
  for (const byte of bytes) {
    result += BASE32_ALPHABET[byte % 32];
  }
  return result;
};

// Base32 decode for TOTP
const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(encoded: string): Buffer {
  const clean = encoded.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export const generateTotpToken = (secret: string, window = 0): string => {
  const counter = Math.floor(Date.now() / 1000 / 30) + window;
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(counter));
  const keyBuf = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", keyBuf);
  hmac.update(counterBuf);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, "0");
};

export const verifyTotpToken = (token: string, secret: string): boolean => {
  // Check current window + 1 step drift each way
  for (let w = -1; w <= 1; w += 1) {
    if (generateTotpToken(secret, w) === token) return true;
  }
  return false;
};

export const generateOtpAuthUrl = (secret: string, email: string, issuer = "ProSMS"): string => {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
};

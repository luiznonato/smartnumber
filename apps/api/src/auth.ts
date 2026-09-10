import { hash, verify } from "argon2";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export async function hashPassword(password: string) {
  if (password.length < 12) {
    throw new Error("Senha deve ter pelo menos 12 caracteres");
  }
  return hash(password, {
    type: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(encoded: string, password: string) {
  return verify(encoded, password);
}

export function issueSession() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: createHash("sha256").update(token).digest("hex"),
  };
}

function encryptionKey(secret: string) {
  if (secret.length < 32) {
    throw new Error("ADMIN_MFA_ENCRYPTION_KEY deve ter ao menos 32 caracteres");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptMfaSecret(value: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptMfaSecret(value: string, secret: string) {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new Error("Segredo MFA inválido");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function recoveryCodeHash(code: string, secret: string) {
  return createHmac("sha256", secret)
    .update(code.trim().toUpperCase())
    .digest("hex");
}

export function verifyWebhook(raw: string, signature: string, secret: string) {
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

export function csvSafe(value: string) {
  return ["=", "+", "-", "@", "\t", "\r"].some((prefix) =>
    value.startsWith(prefix),
  )
    ? `'${value}`
    : value;
}

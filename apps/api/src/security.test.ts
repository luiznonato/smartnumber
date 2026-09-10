import { describe, expect, it } from "vitest";
import {
  csvSafe,
  decryptMfaSecret,
  encryptMfaSecret,
  hashPassword,
  issueSession,
  recoveryCodeHash,
  verifyPassword,
  verifyWebhook,
} from "./auth.js";
import { consumeQuota, SandboxBillingProvider } from "./quota.js";

describe("security and SaaS", () => {
  it("hashes Argon2id passwords", async () => {
    const hashed = await hashPassword("uma-senha-bem-longa");
    expect(await verifyPassword(hashed, "uma-senha-bem-longa")).toBe(true);
    expect(hashed).toContain("argon2id");
  });

  it("does not store session token", () => {
    const session = issueSession();
    expect(session.token).not.toBe(session.tokenHash);
  });

  it("encrypts MFA secrets and hashes recovery codes", () => {
    const key = "uma-chave-separada-com-mais-de-32-caracteres";
    const encrypted = encryptMfaSecret("TOTP-SECRET", key);
    expect(encrypted).not.toContain("TOTP-SECRET");
    expect(decryptMfaSecret(encrypted, key)).toBe("TOTP-SECRET");
    expect(recoveryCodeHash("ABC-123", key)).toBe(
      recoveryCodeHash("abc-123", key),
    );
  });

  it("rejects unsigned billing", () =>
    expect(verifyWebhook("x", "bad", "")).toBe(false));

  it("prevents CSV formulas", () =>
    expect(csvSafe("=1+1")).toBe("'=1+1"));

  it("consumes quotas idempotently", () => {
    const counter = { used: 0, limit: 1, seen: new Set<string>() };
    consumeQuota(counter, 1, "a");
    consumeQuota(counter, 1, "a");
    expect(counter.used).toBe(1);
    expect(() => consumeQuota(counter, 1, "b")).toThrow();
  });

  it("fails closed in billing sandbox", async () =>
    await expect(
      new SandboxBillingProvider().createHostedCheckout("u", "p"),
    ).rejects.toThrow());
});
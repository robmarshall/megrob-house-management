import { describe, it, expect } from "vitest";
import { resolveSeedConfig, hashPassword } from "./seedHelpers.js";

describe("resolveSeedConfig", () => {
  it("throws when SEED_ADMIN_EMAIL is missing", () => {
    expect(() =>
      resolveSeedConfig({ SEED_ADMIN_PASSWORD: "secret" } as NodeJS.ProcessEnv),
    ).toThrow(/SEED_ADMIN_EMAIL/);
  });

  it("throws when SEED_ADMIN_EMAIL is empty/whitespace", () => {
    expect(() =>
      resolveSeedConfig({
        SEED_ADMIN_EMAIL: "   ",
        SEED_ADMIN_PASSWORD: "secret",
      } as NodeJS.ProcessEnv),
    ).toThrow(/SEED_ADMIN_EMAIL/);
  });

  it("throws when SEED_ADMIN_PASSWORD is missing", () => {
    expect(() =>
      resolveSeedConfig({
        SEED_ADMIN_EMAIL: "admin@example.com",
      } as NodeJS.ProcessEnv),
    ).toThrow(/SEED_ADMIN_PASSWORD/);
  });

  it("throws when SEED_ADMIN_PASSWORD is empty", () => {
    expect(() =>
      resolveSeedConfig({
        SEED_ADMIN_EMAIL: "admin@example.com",
        SEED_ADMIN_PASSWORD: "",
      } as NodeJS.ProcessEnv),
    ).toThrow(/SEED_ADMIN_PASSWORD/);
  });

  it("returns provided email/password and a default name when SEED_ADMIN_NAME is unset", () => {
    const cfg = resolveSeedConfig({
      SEED_ADMIN_EMAIL: "admin@example.com",
      SEED_ADMIN_PASSWORD: "s3cret",
    } as NodeJS.ProcessEnv);

    expect(cfg).toEqual({
      email: "admin@example.com",
      password: "s3cret",
      name: "Admin",
    });
  });

  it("returns the provided name when SEED_ADMIN_NAME is set", () => {
    const cfg = resolveSeedConfig({
      SEED_ADMIN_EMAIL: "admin@example.com",
      SEED_ADMIN_PASSWORD: "s3cret",
      SEED_ADMIN_NAME: "Ops Admin",
    } as NodeJS.ProcessEnv);

    expect(cfg.name).toBe("Ops Admin");
  });
});

describe("hashPassword", () => {
  const HEX = /^[0-9a-f]+$/;

  it("resolves to a <hex-salt>:<hex-hash> string with a 32-char salt", async () => {
    const result = await hashPassword("somePassword");

    expect(typeof result).toBe("string");
    // exactly one colon
    expect(result.split(":")).toHaveLength(2);

    const [salt, hash] = result.split(":");
    expect(salt).toMatch(HEX);
    expect(hash).toMatch(HEX);
    // 16-byte salt encoded as hex => 32 chars
    expect(salt).toHaveLength(32);
    expect(hash.length).toBeGreaterThan(0);
  });

  it("produces different outputs for the same password (random salt)", async () => {
    const a = await hashPassword("somePassword");
    const b = await hashPassword("somePassword");

    expect(a).not.toBe(b);
  });
});

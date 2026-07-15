import { describe, it, expect } from "vitest";
import { REQUIRED_ENV_VARS, EMAIL_ENV_VARS, getMissingEnvVars } from "./env.js";

/**
 * Build a fake env object with every REQUIRED_ENV_VAR set to a dummy value.
 * Never touches the real process.env.
 */
function buildFullEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const name of REQUIRED_ENV_VARS) {
    env[name] = `test-${name}`;
  }
  return env;
}

describe("getMissingEnvVars", () => {
  it("returns [] when the provided env has all REQUIRED_ENV_VARS set", () => {
    const env = buildFullEnv();
    expect(getMissingEnvVars(REQUIRED_ENV_VARS, env)).toEqual([]);
  });

  it("reports variables that are absent from the env", () => {
    const env = buildFullEnv();
    delete env.BETTER_AUTH_SECRET;
    delete env.FRONTEND_URL;

    const missing = getMissingEnvVars(REQUIRED_ENV_VARS, env);
    expect(missing).toContain("BETTER_AUTH_SECRET");
    expect(missing).toContain("FRONTEND_URL");
    expect(missing).toHaveLength(2);
  });

  it("treats empty-string values as missing", () => {
    const env = buildFullEnv();
    env.DATABASE_URL = "";

    const missing = getMissingEnvVars(REQUIRED_ENV_VARS, env);
    expect(missing).toContain("DATABASE_URL");
  });

  it("defaults `required` to REQUIRED_ENV_VARS when only an env is passed", () => {
    const env = buildFullEnv();
    delete env.BETTER_AUTH_URL;

    const missing = getMissingEnvVars(undefined, env);
    expect(missing).toEqual(["BETTER_AUTH_URL"]);
  });

  it("reports missing EMAIL_ENV_VARS when checked explicitly", () => {
    // A core-only env (no SMTP vars set) is fully missing the email config.
    const env = buildFullEnv();
    const missing = getMissingEnvVars(EMAIL_ENV_VARS, env);
    expect(missing).toEqual([...EMAIL_ENV_VARS]);
  });
});

describe("REQUIRED_ENV_VARS", () => {
  it("includes the core app/database/auth env vars", () => {
    for (const name of [
      "DATABASE_URL",
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_URL",
      "FRONTEND_URL",
    ]) {
      expect(REQUIRED_ENV_VARS).toContain(name);
    }
  });

  it("no longer requires the removed QueueBear vars", () => {
    for (const name of [
      "QUEUEBEAR_API_KEY",
      "QUEUEBEAR_PROJECT_ID",
      "QUEUEBEAR_REDIRECT_URL",
      "QUEUEBEAR_SIGNING_SECRET",
    ]) {
      expect(REQUIRED_ENV_VARS).not.toContain(name);
    }
  });

  it("does NOT treat SMTP vars as boot-fatal (they live in EMAIL_ENV_VARS)", () => {
    for (const name of EMAIL_ENV_VARS) {
      expect(REQUIRED_ENV_VARS).not.toContain(name);
    }
  });
});

describe("EMAIL_ENV_VARS", () => {
  it("lists the SMTP vars needed for password-reset emails", () => {
    for (const name of [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASS",
      "SMTP_FROM",
    ]) {
      expect(EMAIL_ENV_VARS).toContain(name);
    }
  });

  it("does not include SMTP_SECURE (has a safe default)", () => {
    expect(EMAIL_ENV_VARS).not.toContain("SMTP_SECURE");
  });
});

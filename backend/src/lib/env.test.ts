import { describe, it, expect } from "vitest";
import { REQUIRED_ENV_VARS, getMissingEnvVars } from "./env.js";

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
    delete env.SMTP_HOST;

    const missing = getMissingEnvVars(REQUIRED_ENV_VARS, env);
    expect(missing).toContain("BETTER_AUTH_SECRET");
    expect(missing).toContain("SMTP_HOST");
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
    delete env.SMTP_PASS;

    const missing = getMissingEnvVars(undefined, env);
    expect(missing).toEqual(["SMTP_PASS"]);
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

  it("includes the SMTP vars without safe defaults", () => {
    for (const name of [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASS",
      "SMTP_FROM",
    ]) {
      expect(REQUIRED_ENV_VARS).toContain(name);
    }
  });

  it("does not require SMTP_SECURE (has a safe default)", () => {
    expect(REQUIRED_ENV_VARS).not.toContain("SMTP_SECURE");
  });
});

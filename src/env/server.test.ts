/**
 * The env module caches its result in a module-level variable and reads real process.env at
 * import time, so each case here resets the module registry and sets process.env before a
 * fresh dynamic import — otherwise tests would just observe whatever the first import saw.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REQUIRED = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
};

const ENV_KEYS = ["NODE_ENV", "DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"] as const;
// @types/node marks NODE_ENV read-only on ProcessEnv to discourage runtime mutation by app
// code; this test file's whole job is exercising env parsing under different inputs, so it
// deliberately bypasses that via a mutable view rather than `as any` scattered everywhere.
const mutableEnv = process.env as unknown as Record<string, string | undefined>;
let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, mutableEnv[key]]));
  vi.resetModules();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete mutableEnv[key];
    else mutableEnv[key] = originalEnv[key];
  }
  vi.doUnmock("node:fs");
});

describe("serverEnv", () => {
  it("parses a fully-configured environment", async () => {
    Object.assign(process.env, REQUIRED, { NODE_ENV: "production" });
    const { serverEnv } = await import("./server");
    expect(serverEnv()).toMatchObject({ ...REQUIRED, NODE_ENV: "production" });
  });

  it("defaults NODE_ENV to development when unset", async () => {
    delete mutableEnv.NODE_ENV;
    Object.assign(process.env, REQUIRED);
    const { serverEnv } = await import("./server");
    expect(serverEnv().NODE_ENV).toBe("development");
  });

  it.each(["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"] as const)(
    "fails fast when %s is missing, naming the variable but never leaking any value",
    async (missingKey) => {
      const values = { ...REQUIRED };
      delete (values as Record<string, string | undefined>)[missingKey];
      Object.assign(process.env, values);
      delete mutableEnv[missingKey];

      // Without this, server.ts's own loadEnvFileOnce() would reload the real project .env
      // and silently refill the var this test just deleted, defeating the whole premise.
      vi.doMock("node:fs", () => ({ existsSync: () => false }));

      const { serverEnv } = await import("./server");
      let thrown: unknown;
      try {
        serverEnv();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      const message = (thrown as Error).message;
      expect(message).toContain(missingKey);
      // The failure must never echo a secret's actual value, only the variable name.
      expect(message).not.toContain(REQUIRED.BETTER_AUTH_SECRET);
    },
  );

  it("rejects a BETTER_AUTH_SECRET shorter than 32 characters", async () => {
    Object.assign(process.env, { ...REQUIRED, BETTER_AUTH_SECRET: "too-short" });
    const { serverEnv } = await import("./server");
    expect(() => serverEnv()).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("rejects a malformed BETTER_AUTH_URL", async () => {
    Object.assign(process.env, { ...REQUIRED, BETTER_AUTH_URL: "not-a-url" });
    const { serverEnv } = await import("./server");
    expect(() => serverEnv()).toThrow(/BETTER_AUTH_URL/);
  });
});

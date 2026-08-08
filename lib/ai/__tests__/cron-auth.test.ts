import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authorizeCronRequest } from "../cron-auth";

const VALID_SECRET = "a-sufficiently-long-cron-secret";

function headers(init: Record<string, string> = {}): Headers {
  return new Headers(init);
}

describe("authorizeCronRequest", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = VALID_SECRET;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  describe("fails closed on configuration", () => {
    it("rejects with 503 when CRON_SECRET is unset", () => {
      delete process.env.CRON_SECRET;
      const result = authorizeCronRequest(
        headers({ authorization: `Bearer ${VALID_SECRET}` }),
      );
      expect(result).toMatchObject({ ok: false, status: 503 });
    });

    it("rejects with 503 when CRON_SECRET is too short to be meaningful", () => {
      process.env.CRON_SECRET = "short";
      const result = authorizeCronRequest(headers({ authorization: "Bearer short" }));
      expect(result).toMatchObject({ ok: false, status: 503 });
    });
  });

  describe("rejects spoofed callers", () => {
    it("rejects a request with no Authorization header", () => {
      expect(authorizeCronRequest(headers())).toMatchObject({
        ok: false,
        status: 401,
      });
    });

    // The header the old implementation trusted — any public caller can set it.
    it("rejects x-vercel-cron: 1 on its own", () => {
      const result = authorizeCronRequest(headers({ "x-vercel-cron": "1" }));
      expect(result).toMatchObject({ ok: false, status: 401 });
    });

    it("rejects x-vercel-cron: 1 combined with a wrong bearer", () => {
      const result = authorizeCronRequest(
        headers({ "x-vercel-cron": "1", authorization: "Bearer not-the-secret" }),
      );
      expect(result).toMatchObject({ ok: false, status: 401 });
    });

    it("rejects a wrong bearer token", () => {
      const result = authorizeCronRequest(
        headers({ authorization: "Bearer wrong-secret-value-here" }),
      );
      expect(result).toMatchObject({ ok: false, status: 401 });
    });

    it("rejects a bearer that is a prefix of the secret", () => {
      const result = authorizeCronRequest(
        headers({ authorization: `Bearer ${VALID_SECRET.slice(0, 10)}` }),
      );
      expect(result).toMatchObject({ ok: false, status: 401 });
    });

    it("rejects a non-Bearer scheme carrying the right secret", () => {
      const result = authorizeCronRequest(
        headers({ authorization: `Basic ${VALID_SECRET}` }),
      );
      expect(result).toMatchObject({ ok: false, status: 401 });
    });

    it("rejects an empty bearer token", () => {
      expect(authorizeCronRequest(headers({ authorization: "Bearer " }))).toMatchObject(
        { ok: false, status: 401 },
      );
    });
  });

  describe("accepts the configured secret", () => {
    it("accepts the exact bearer token", () => {
      const result = authorizeCronRequest(
        headers({ authorization: `Bearer ${VALID_SECRET}` }),
      );
      expect(result).toEqual({ ok: true });
    });

    it("accepts a lowercase bearer scheme", () => {
      const result = authorizeCronRequest(
        headers({ authorization: `bearer ${VALID_SECRET}` }),
      );
      expect(result).toEqual({ ok: true });
    });

    it("looks the header up case-insensitively", () => {
      const result = authorizeCronRequest(
        headers({ Authorization: `Bearer ${VALID_SECRET}` }),
      );
      expect(result).toEqual({ ok: true });
    });
  });
});

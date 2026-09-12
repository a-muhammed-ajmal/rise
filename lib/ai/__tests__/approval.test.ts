import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";
import { signApprovalToken, verifyApprovalToken } from "../approval";

describe("approval tokens", () => {
  beforeEach(() => {
    process.env.APPROVAL_HMAC_SECRET = "test-approval-secret";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"));
  });

  afterEach(() => {
    delete process.env.APPROVAL_HMAC_SECRET;
    vi.useRealTimers();
  });

  it("round-trips an untampered, user-bound token", () => {
    const payload = {
      userId: randomUUID(),
      toolName: "delete_task",
      input: { id: randomUUID() },
      exp: Date.now() + 60_000,
      jti: randomUUID(),
    };
    expect(verifyApprovalToken(signApprovalToken(payload), payload.userId)).toEqual(
      payload,
    );
  });

  it("rejects tampering, another user, and expired tokens", () => {
    const userId = randomUUID();
    const token = signApprovalToken({
      userId,
      toolName: "delete_task",
      input: { id: randomUUID() },
      exp: Date.now() + 1_000,
      jti: randomUUID(),
    });

    expect(verifyApprovalToken(`${token}x`, userId)).toBeNull();
    expect(verifyApprovalToken(token, randomUUID())).toBeNull();
    vi.advanceTimersByTime(1_001);
    expect(verifyApprovalToken(token, userId)).toBeNull();
  });

  it("fails closed when the signing secret is missing", () => {
    delete process.env.APPROVAL_HMAC_SECRET;
    expect(() =>
      signApprovalToken({
        userId: randomUUID(),
        toolName: "delete_task",
        input: {},
        exp: Date.now() + 1_000,
        jti: randomUUID(),
      }),
    ).toThrow("APPROVAL_HMAC_SECRET");
  });
});

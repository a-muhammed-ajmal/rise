import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const ApprovalPayloadSchema = z.object({
  userId: z.string().uuid(),
  toolName: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  exp: z.number().int().positive(),
  jti: z.string().uuid(),
});

export type ApprovalPayload = z.infer<typeof ApprovalPayloadSchema>;

function hmacSecret(): string {
  const secret = process.env.APPROVAL_HMAC_SECRET;
  if (!secret) throw new Error("APPROVAL_HMAC_SECRET env var is required");
  return secret;
}

export function signApprovalToken(payload: ApprovalPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", hmacSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

export function verifyApprovalToken(
  token: string,
  userId: string,
): ApprovalPayload | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const data = token.slice(0, dot);
    const signature = token.slice(dot + 1);
    const expected = createHmac("sha256", hmacSecret()).update(data).digest();
    const actual = Buffer.from(signature, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return null;
    }

    const decoded: unknown = JSON.parse(
      Buffer.from(data, "base64url").toString(),
    );
    const parsed = ApprovalPayloadSchema.safeParse(decoded);
    if (!parsed.success) return null;
    if (parsed.data.userId !== userId || Date.now() > parsed.data.exp) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

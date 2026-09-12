import { expect, test } from "@playwright/test";

test("public offline fallback stays reachable and carries security headers", async ({
  request,
}) => {
  const response = await request.get("/offline");

  expect(response.status()).toBe(200);
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(response.headers()["permissions-policy"]).toContain("microphone=(self)");
  expect(response.headers()["strict-transport-security"]).toContain(
    "max-age=63072000",
  );

  const csp = response.headers()["content-security-policy"];
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
});

test("service worker is public, JavaScript, and revalidated", async ({ request }) => {
  const response = await request.get("/sw.js");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("javascript");
  expect(response.headers()["cache-control"]).toContain("must-revalidate");
  expect(response.headers()["content-security-policy"]).toBe(
    "default-src 'self'; script-src 'self'",
  );
  expect(await response.text()).toContain("self.addEventListener");
});

import { describe, expect, it } from "vitest";
import { topbarTitle } from "./topbar";

describe("topbarTitle", () => {
  it("names the finance module", () => {
    expect(topbarTitle("/finance")).toBe("Financial");
    expect(topbarTitle("/finance/anything")).toBe("Financial");
  });

  it("falls back to null elsewhere", () => {
    expect(topbarTitle("/")).toBeNull();
    expect(topbarTitle("/financeverything")).toBeNull();
    expect(topbarTitle(null)).toBeNull();
  });
});

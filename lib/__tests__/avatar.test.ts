import { describe, expect, it } from "vitest";
import {
  AVATAR_MIME_EXTENSIONS,
  MAX_AVATAR_BYTES,
  avatarUploadErrorMessage,
} from "../avatar";

describe("avatar rules", () => {
  it("accepts the four image types the bucket allows", () => {
    expect(Object.keys(AVATAR_MIME_EXTENSIONS).sort()).toEqual([
      "image/gif",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    expect(AVATAR_MIME_EXTENSIONS["image/jpeg"]).toBe("jpg");
  });

  it("caps photos at the bucket's 5 MB limit", () => {
    expect(MAX_AVATAR_BYTES).toBe(5242880);
  });
});

describe("avatarUploadErrorMessage", () => {
  it("names a missing bucket", () => {
    expect(avatarUploadErrorMessage("Bucket not found")).toContain(
      "create the 'avatars' bucket",
    );
  });

  it("names missing upload permission", () => {
    expect(
      avatarUploadErrorMessage("new row violates row-level security policy"),
    ).toContain("add the 'avatars' Storage policies");
    expect(avatarUploadErrorMessage("Unauthorized")).toContain(
      "Storage policies",
    );
  });

  it("explains a file that is too big or the wrong type", () => {
    expect(
      avatarUploadErrorMessage("The object exceeded the maximum allowed size"),
    ).toBe("Profile photos must be 5 MB or smaller");
    expect(
      avatarUploadErrorMessage("mime type image/bmp is not supported"),
    ).toBe("Use a JPG, PNG, WebP, or GIF image");
  });

  it("falls back to a plain retry message", () => {
    expect(avatarUploadErrorMessage("fetch failed")).toBe(
      "Photo upload failed. Please try again",
    );
  });
});

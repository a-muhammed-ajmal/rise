/**
 * RISE maskable icon pipeline.
 *
 *   node scripts/generate-icons.mjs
 *
 * Every other app/PWA icon is a supplied brand asset copied in verbatim from
 * the RISE logo package — do not regenerate those here. Only the two maskable
 * PWA tiles are derived, because Android crops a maskable icon to a circle or
 * squircle and a transparent source would lose its ground. The mark is placed
 * on a white plate at 62% (inside the maskable safe zone); white is used
 * because both the navy leaves and the golden leaf read against it.
 *
 * Source of truth: public/icon-1024.png (supplied RISE-logo-1024x1024.png).
 * Outputs:
 *
 *   public/icon-maskable-192.png   192  white plate, mark at 62%
 *   public/icon-maskable-512.png   512  white plate, mark at 62%
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "public", "icon-1024.png");

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const SAFE_ZONE = 0.62;

/** The supplied PNGs carry their own clear space; trim to the true bounding
 *  box first so the safe-zone percentage is measured against the mark. */
const mark = await sharp(SRC)
  .ensureAlpha()
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
  .png()
  .toBuffer();

/** Square white plate with the mark centered at `scale` of the plate size. */
async function plate(size, scale, outPath) {
  const inner = Math.round(size * scale);
  const resized = await sharp(mark)
    .resize(inner, inner, { fit: "inside" })
    .png()
    .toBuffer();
  const meta = await sharp(resized).metadata();

  await sharp({
    create: { width: size, height: size, channels: 4, background: WHITE },
  })
    .composite([
      {
        input: resized,
        left: Math.round((size - meta.width) / 2),
        top: Math.round((size - meta.height) / 2),
      },
    ])
    .png()
    .toFile(outPath);
  console.log(`✓ ${path.relative(root, outPath)} (${size}x${size})`);
}

await plate(192, SAFE_ZONE, path.join(root, "public", "icon-maskable-192.png"));
await plate(512, SAFE_ZONE, path.join(root, "public", "icon-maskable-512.png"));

console.log("Done.");

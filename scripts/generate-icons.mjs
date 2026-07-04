/**
 * RISE icon pipeline — regenerates every app/PWA icon from the master logo.
 *
 *   node scripts/generate-icons.mjs
 *
 * Source of truth: public/rise-ai.png (bee mark, any size, white or
 * transparent background). Outputs:
 *
 *   public/rise-logo.png           512  transparent mark (in-app renders)
 *   public/icon-192.png            192  white tile, mark at 80%
 *   public/icon-512.png            512  white tile, mark at 80%
 *   public/icon-maskable-192.png   192  white tile, mark at 62% (safe zone)
 *   public/icon-maskable-512.png   512  white tile, mark at 62% (safe zone)
 *   public/apple-touch-icon.png    180  white tile, mark at 80%
 *   app/icon.png                    96  white tile (Next.js favicon)
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "public", "rise-ai.png");

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** Load the master, knock near-white background out to transparency,
 *  and trim to the mark's bounding box. */
async function loadMark() {
  const { data, info } = await sharp(SRC)
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 242 && data[i + 1] > 242 && data[i + 2] > 242) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()
    .then((buf) =>
      sharp(buf)
        .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
        .png()
        .toBuffer()
    );
}

/** Square white tile with the mark centered at `scale` of the tile size. */
async function tile(mark, size, scale, outPath) {
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

const mark = await loadMark();

await sharp(mark)
  .resize(512, 512, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile(path.join(root, "public", "rise-logo.png"));
console.log("✓ public/rise-logo.png (512x512, transparent)");

await tile(mark, 192, 0.8, path.join(root, "public", "icon-192.png"));
await tile(mark, 512, 0.8, path.join(root, "public", "icon-512.png"));
await tile(mark, 192, 0.62, path.join(root, "public", "icon-maskable-192.png"));
await tile(mark, 512, 0.62, path.join(root, "public", "icon-maskable-512.png"));
await tile(mark, 180, 0.8, path.join(root, "public", "apple-touch-icon.png"));
await tile(mark, 96, 0.8, path.join(root, "app", "icon.png"));

console.log("Done.");

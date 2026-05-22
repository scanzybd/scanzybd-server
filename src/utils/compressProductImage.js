import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

/** Resolve sharp from startup-server/package.json (works even if cwd is repo root). */
const require = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json")
);
const sharp = require("sharp");

const MAX_WIDTH = 800;
const MAX_HEIGHT = 600;
const WEBP_QUALITY = 80;

/**
 * Resize product images for catalog/detail pages (WebP, no upscale).
 * @param {Buffer} inputBuffer
 * @returns {Promise<Buffer>}
 */
export async function compressProductImage(inputBuffer) {
  if (!inputBuffer?.length) {
    throw new Error("Empty image buffer");
  }

  return sharp(inputBuffer)
    .rotate()
    .resize(MAX_WIDTH, MAX_HEIGHT, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

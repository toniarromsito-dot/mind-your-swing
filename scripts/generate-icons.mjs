import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const anySvg = readFileSync(new URL("../public/icons/icon-512.svg", import.meta.url));
const maskableSvg = readFileSync(new URL("../public/icons/icon-512-maskable.svg", import.meta.url));

const sizes = [192, 256, 384, 512];

for (const size of sizes) {
  await sharp(anySvg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(`../public/icons/icon-${size}.png`, import.meta.url)));
}

await sharp(maskableSvg, { density: 384 })
  .resize(512, 512)
  .png()
  .toFile(fileURLToPath(new URL("../public/icons/icon-512-maskable.png", import.meta.url)));

// apple-touch-icon: sin transparencia, tamaño estándar 180x180
await sharp(anySvg, { density: 384 })
  .resize(180, 180)
  .flatten({ background: "#1F3D2B" })
  .png()
  .toFile(fileURLToPath(new URL("../public/icons/apple-touch-icon.png", import.meta.url)));

console.log("Iconos generados en public/icons/");

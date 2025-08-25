import fs from "node:fs/promises";
import sharp from "sharp";
import toIco from "to-ico";

const SRC = "public/icons/icon-maskable.svg";
const OUT = "public/icons";

const sizes = [16, 32, 48, 180, 192, 256, 384, 512];

await fs.mkdir(OUT, { recursive: true });

for (const s of sizes) {
  const out = `${OUT}/icon-${s}.png`;
  await sharp(SRC).resize(s, s).png({ quality: 100 }).toFile(out);
}

await sharp(SRC).resize(192, 192).png().toFile(`${OUT}/android-chrome-192x192.png`);
await sharp(SRC).resize(512, 512).png().toFile(`${OUT}/android-chrome-512x512.png`);
await sharp(SRC).resize(192, 192).png().toFile(`${OUT}/maskable-192.png`);
await sharp(SRC).resize(512, 512).png().toFile(`${OUT}/maskable-512.png`);
await sharp("public/icons/favicon.svg").resize(32, 32).png().toFile(`${OUT}/favicon-32.png`);
await sharp("public/icons/favicon.svg").resize(16, 16).png().toFile(`${OUT}/favicon-16.png`);

const icoBuffer = await toIco([
  await fs.readFile(`${OUT}/icon-16.png`),
  await fs.readFile(`${OUT}/icon-32.png`),
  await fs.readFile(`${OUT}/icon-48.png`)
]);
await fs.writeFile(`${OUT}/favicon.ico`, icoBuffer);

console.log("Ícones gerados em /public/icons ✅");

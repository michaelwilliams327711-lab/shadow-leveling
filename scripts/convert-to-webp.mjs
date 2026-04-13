/**
 * Strike 24 — Asset Purge
 * Converts all .png files in public/images/ (except icons) to .webp at quality 85.
 * Originals are moved to public/images/backup/.
 *
 * Skips: icon-192.png, icon-512.png (PWA manifest requires PNG with image/png MIME type)
 * Also converts: attached_assets/images/ (sins-bg, virtues-bg — used by CelestialDuel Vite import)
 */

import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const PWA_ICONS = new Set(["icon-192.png", "icon-512.png"]);

const TARGETS = [
  {
    src: path.join(root, "artifacts/shadow-leveling/public/images"),
    backup: path.join(root, "artifacts/shadow-leveling/public/images/backup"),
    recurse: true,
  },
  {
    src: path.join(root, "attached_assets/images"),
    backup: path.join(root, "attached_assets/images/backup"),
    recurse: false,
  },
];

async function convertDir({ src, backup, recurse }) {
  await fs.mkdir(backup, { recursive: true });

  const entries = await fs.readdir(src, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (recurse && entry.name !== "backup") {
        const subSrc = path.join(src, entry.name);
        const subBackup = path.join(backup, entry.name);
        const subResults = await convertDir({ src: subSrc, backup: subBackup, recurse: false });
        results.push(...subResults);
      }
      continue;
    }

    if (!entry.name.endsWith(".png")) continue;
    if (PWA_ICONS.has(entry.name)) {
      results.push({ file: entry.name, status: "skipped (PWA icon — PNG required)" });
      continue;
    }

    const srcFile = path.join(src, entry.name);
    const webpName = entry.name.replace(/\.png$/, ".webp");
    const destFile = path.join(src, webpName);
    const backupFile = path.join(backup, entry.name);

    const origStat = await fs.stat(srcFile);

    await sharp(srcFile)
      .webp({ quality: 85, effort: 6 })
      .toFile(destFile);

    const newStat = await fs.stat(destFile);

    await fs.rename(srcFile, backupFile);

    const reduction = (((origStat.size - newStat.size) / origStat.size) * 100).toFixed(1);
    results.push({
      file: entry.name,
      status: "converted",
      original: `${(origStat.size / 1024 / 1024).toFixed(2)} MB`,
      webp: `${(newStat.size / 1024).toFixed(0)} KB`,
      reduction: `${reduction}%`,
    });
  }

  return results;
}

console.log("\n=== STRIKE 24: ASSET PURGE — WebP Conversion ===\n");

let grandTotal = { originalBytes: 0, newBytes: 0 };

for (const target of TARGETS) {
  console.log(`Processing: ${path.relative(root, target.src)}`);
  try {
    const results = await convertDir(target);
    for (const r of results) {
      if (r.status === "converted") {
        console.log(`  ✓ ${r.file} → .webp | ${r.original} → ${r.webp} | −${r.reduction}`);
      } else {
        console.log(`  ⊘ ${r.file} | ${r.status}`);
      }
    }
  } catch (err) {
    console.error(`  ERROR processing ${target.src}:`, err.message);
  }
  console.log();
}

console.log("=== PURGE COMPLETE ===");
console.log("Originals backed up. Update source references from .png → .webp.\n");

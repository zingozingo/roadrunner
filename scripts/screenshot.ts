/**
 * Visual screenshot tool for autonomous UI agent.
 *
 * Usage:
 *   npx tsx scripts/screenshot.ts /partners        # 1440px wide
 *   npx tsx scripts/screenshot.ts /partners 1280   # custom width
 *
 * Saves to .claude/screenshots/{path-slug}_{width}.png
 */

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE_URL = "http://localhost:3000";
const SCREENSHOTS_DIR = path.resolve(__dirname, "../.claude/screenshots");

async function main() {
  const urlPath = process.argv[2];
  if (!urlPath) {
    console.error("Usage: npx tsx scripts/screenshot.ts <path> [width]");
    console.error("  e.g. npx tsx scripts/screenshot.ts /partners 1440");
    process.exit(1);
  }

  const width = parseInt(process.argv[3] || "1440", 10);
  const height = 900;

  // Build a filesystem-safe slug from the URL path
  const slug = urlPath
    .replace(/^\//, "")
    .replace(/\//g, "-")
    .replace(/[^a-zA-Z0-9\-_]/g, "_") || "root";

  const filename = `${slug}_${width}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  // Ensure output directory exists
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height } });

  await page.goto(`${BASE_URL}${urlPath}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: filepath, fullPage: true });

  await browser.close();

  // Log the path so the agent can pick it up
  console.log(filepath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

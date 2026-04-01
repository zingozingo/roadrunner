/**
 * Interaction sequence runner for autonomous UI agent.
 *
 * Usage:
 *   npx tsx scripts/interact.ts '[{"action":"goto","path":"/partners"},{"action":"screenshot","name":"partners"}]'
 *
 * Executes steps in order. On failure: captures error screenshot, stops, reports.
 * Output: JSON result to stdout with pass/fail per step.
 */

import { chromium, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE_URL = "http://localhost:3000";
const SCREENSHOTS_DIR = path.resolve(__dirname, "../.claude/screenshots");

type Step =
  | { action: "goto"; path: string }
  | { action: "click"; selector: string }
  | { action: "fill"; selector: string; value: string }
  | { action: "select"; selector: string; value: string }
  | { action: "wait"; ms: number }
  | { action: "wait_for"; selector: string; state: "visible" | "hidden" | "attached" | "detached" }
  | { action: "screenshot"; name: string }
  | { action: "assert_visible"; selector: string }
  | { action: "assert_hidden"; selector: string }
  | { action: "assert_text"; selector: string; text: string }
  | { action: "assert_url"; path: string };

interface StepResult {
  step: number;
  action: string;
  passed: boolean;
  error?: string;
}

async function runStep(page: Page, step: Step, index: number): Promise<StepResult> {
  const base: StepResult = { step: index, action: step.action, passed: true };

  switch (step.action) {
    case "goto":
      await page.goto(`${BASE_URL}${step.path}`, { waitUntil: "networkidle" });
      break;

    case "click":
      await page.locator(step.selector).click({ timeout: 10000 });
      break;

    case "fill":
      await page.locator(step.selector).fill(step.value, { timeout: 10000 });
      break;

    case "select":
      await page.locator(step.selector).selectOption(step.value, { timeout: 10000 });
      break;

    case "wait":
      await page.waitForTimeout(step.ms);
      break;

    case "wait_for":
      await page.locator(step.selector).waitFor({ state: step.state, timeout: 15000 });
      break;

    case "screenshot": {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
      const filepath = path.join(SCREENSHOTS_DIR, `${step.name}.png`);
      await page.screenshot({ path: filepath, fullPage: true });
      base.error = filepath; // repurpose as info — the path to the saved file
      break;
    }

    case "assert_visible":
      await page.locator(step.selector).waitFor({ state: "visible", timeout: 10000 });
      break;

    case "assert_hidden":
      await page.locator(step.selector).waitFor({ state: "hidden", timeout: 10000 });
      break;

    case "assert_text": {
      const el = page.locator(step.selector);
      await el.waitFor({ state: "visible", timeout: 10000 });
      const actual = await el.textContent();
      if (!actual?.includes(step.text)) {
        throw new Error(`Expected text "${step.text}" in "${step.selector}", got "${actual}"`);
      }
      break;
    }

    case "assert_url": {
      const url = new URL(page.url());
      if (url.pathname !== step.path) {
        throw new Error(`Expected URL path "${step.path}", got "${url.pathname}"`);
      }
      break;
    }

    default:
      throw new Error(`Unknown action: ${(step as { action: string }).action}`);
  }

  return base;
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: npx tsx scripts/interact.ts '<json steps array>'");
    process.exit(1);
  }

  let steps: Step[];
  try {
    steps = JSON.parse(input);
  } catch {
    console.error("Invalid JSON input");
    process.exit(1);
  }

  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const results: StepResult[] = [];
  let passed = true;
  let finalError: string | undefined;

  for (let i = 0; i < steps.length; i++) {
    try {
      const result = await runStep(page, steps[i], i);
      results.push(result);
    } catch (err) {
      passed = false;
      const message = err instanceof Error ? err.message : String(err);
      results.push({ step: i, action: steps[i].action, passed: false, error: message });
      finalError = `Step ${i} (${steps[i].action}) failed: ${message}`;

      // Capture failure screenshot
      const failPath = path.join(SCREENSHOTS_DIR, `failure_step_${i}.png`);
      try {
        await page.screenshot({ path: failPath, fullPage: true });
        finalError += ` | Screenshot: ${failPath}`;
      } catch {
        // Page may be in a bad state — skip failure screenshot
      }

      break;
    }
  }

  await browser.close();

  const output = { passed, steps: results, ...(finalError ? { error: finalError } : {}) };
  console.log(JSON.stringify(output, null, 2));

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

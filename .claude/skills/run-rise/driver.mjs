#!/usr/bin/env node
/**
 * RISE dev-server driver.
 * Usage: node .claude/skills/run-rise/driver.mjs [command] [arg]
 *
 * Commands:
 *   screenshot [url]   Take a screenshot (default: /login)
 *   get <path>         curl a path, print status + body
 *   title [url]        Print the page <title>
 *
 * Env:
 *   PORT  (default 3002) — port where `next dev --webpack --port PORT` is running
 *   SS    (default /tmp/rise-ss.png) — screenshot output path
 */

import { createRequire } from 'module';
import { execSync } from 'child_process';

const PORT = process.env.PORT ?? '3002';
const BASE = `http://localhost:${PORT}`;
const SS_PATH = process.env.SS ?? '/tmp/rise-ss.png';

const PLAYWRIGHT_PATH = '/usr/local/share/npm-global/lib/node_modules/playwright';

const [, , cmd = 'screenshot', arg] = process.argv;

async function withBrowser(fn) {
  const require = createRequire(import.meta.url);
  let pw;
  try {
    pw = require(PLAYWRIGHT_PATH);
  } catch {
    console.error(`playwright not found at ${PLAYWRIGHT_PATH}`);
    console.error('Install: npm install -g playwright && npx playwright install chromium --with-deps');
    process.exit(1);
  }
  const browser = await pw.chromium.launch({ headless: true });
  try {
    await fn(browser);
  } finally {
    await browser.close();
  }
}

if (cmd === 'screenshot') {
  const url = arg ? (arg.startsWith('http') ? arg : `${BASE}${arg}`) : `${BASE}/login`;
  await withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await page.screenshot({ path: SS_PATH, fullPage: true });
    console.log(`screenshot -> ${SS_PATH}  (title: "${await page.title()}")`);
  });

} else if (cmd === 'title') {
  const url = arg ? (arg.startsWith('http') ? arg : `${BASE}${arg}`) : `${BASE}/login`;
  await withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    console.log(await page.title());
  });

} else if (cmd === 'get') {
  if (!arg) { console.error('Usage: driver.mjs get <path>'); process.exit(1); }
  const url = arg.startsWith('http') ? arg : `${BASE}${arg}`;
  try {
    const out = execSync(`curl -s -L -w "\\nHTTP %{http_code}" "${url}"`, { encoding: 'utf8' });
    console.log(out);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

} else {
  console.error(`Unknown command: ${cmd}`);
  console.error('Commands: screenshot [url], title [url], get <path>');
  process.exit(1);
}

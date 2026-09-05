import test from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { fileURLToPath } from 'url';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch (e) {
  // Playwright not installed; tests will be skipped
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const guides = [
  'index.dc.html',
  'Behringer Setup Guide.dc.html',
  'SampleCircuit Guide.dc.html',
  'DDJ-FLX4 Guide.dc.html',
  'MPK Mini MK4 Guide.dc.html',
  'TR-06 Guide.dc.html',
];

test('Guide Boot Check: guides load without errors', { skip: !chromium }, async (t) => {
  let browser;
  try {
    const options = {};
    // Use pre-installed Chromium in CI if available
    if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
      options.executablePath = path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium', 'chromium');
    }
    browser = await chromium.launch(options);

    for (const guide of guides) {
      await t.test(`${guide} boots successfully`, async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        let navigationError = null;

        page.on('error', (err) => {
          navigationError = err;
        });

        const guideUrl = `file://${path.join(rootDir, guide)}`;
        try {
          await page.goto(guideUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

          if (navigationError) {
            throw navigationError;
          }

          // Check for uncaught errors in console
          const consoleErrors = [];
          page.on('console', (msg) => {
            if (msg.type() === 'error') {
              consoleErrors.push(msg.text());
            }
          });

          // Wait a bit for any initial scripts to run
          await page.waitForTimeout(1000);

          assert.strictEqual(consoleErrors.length, 0, `Console errors detected: ${consoleErrors.join(', ')}`);

          // Check that the page has content
          const title = await page.title();
          assert.ok(title.length > 0, 'Page has no title');

        } catch (e) {
          throw new Error(`Failed to boot ${guide}: ${e.message}`);
        } finally {
          await context.close();
        }
      });
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

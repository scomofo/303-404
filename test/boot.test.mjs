import test from 'node:test';
import assert from 'node:assert';
import path from 'path';
import http from 'node:http';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { GUIDES } from './harness.mjs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch (e) {
  // Playwright not installed; tests will be skipped
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const guides = [
  'index.html',
  'index.dc.html',
  'groove-studio.html',
  ...GUIDES.map(guide => guide.file),
];

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav',
};

// Guides are meant to be served over HTTP (see README: "Serve the repository
// to use the practice home and courses"). file:// origins are null, so the
// runtime's own-document fetch is blocked by CORS and pollutes the console
// even though the catch swallows the rejection. Serve the repo root locally
// so the boot check matches how the app actually runs.
function startStaticServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const filePath = path.join(rootDir, urlPath === '/' ? 'index.html' : urlPath);
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      const body = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('Guide Boot Check: guides load without errors', { skip: !chromium }, async (t) => {
  let browser;
  let server;
  try {
    server = await startStaticServer();
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

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

        // Attach the console listener before navigation so early errors
        // cannot slip past it.
        const consoleErrors = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
          }
        });

        const guideUrl = `${baseUrl}/${guide}`;
        try {
          await page.goto(guideUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

          if (navigationError) {
            throw navigationError;
          }

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
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
});

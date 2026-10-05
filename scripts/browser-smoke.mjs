import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://127.0.0.1').pathname);
  const requested = resolve(root, `.${pathname}`);
  assert.equal(relative(root, requested).startsWith('..'), false, 'Invalid request path');
  return requested;
}

const server = createServer(async (request, response) => {
  try {
    const pathname = resolveRequestPath(request.url ?? '/');
    const file = (await stat(pathname)).isDirectory() ? join(pathname, 'index.html') : pathname;
    response.writeHead(200, {
      'content-type': mimeTypes[extname(file)] ?? 'application/octet-stream',
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer));
const address = server.address();
assert.notEqual(address, null);
assert.equal(typeof address, 'object');

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  const messages = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  page.on('console', (message) => messages.push(message.text()));

  await page.goto(`http://127.0.0.1:${address.port}/examples/index.html`, {
    waitUntil: 'networkidle',
  });
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 2);

  assert.deepEqual(pageErrors, []);
  assert.ok(
    messages.some((message) => /^Created \d+ paths$/.test(message)),
    'Example did not sample SVG paths',
  );
  console.log('Browser smoke test loaded the example, WASM parser, and sampled SVG paths.');
} finally {
  await browser?.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

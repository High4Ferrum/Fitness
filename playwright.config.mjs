import { defineConfig } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3101',
    actionTimeout: 10_000,
    viewport: { width: 1440, height: 1000 },
    timezoneId: 'UTC',
    ...(process.platform === 'linux' ? { launchOptions: { executablePath: await chromium.executablePath(), args: chromium.args.filter(arg => arg !== '--single-process'), env: { ...process.env, XDG_CACHE_HOME: '/tmp/form-browser-cache' } } } : { channel: 'chrome' }),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node server/index.mjs',
    url: 'http://127.0.0.1:3101/api/health',
    env: { PORT: '3101', FORM_DB_PATH: join(tmpdir(), `form-browser-${process.pid}.sqlite`), FORM_SEED_DEMO: '1' },
    reuseExistingServer: false,
  },
});

import { defineConfig } from '@playwright/test';
import local from './playwright.config.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = Number(process.env.FORM_E2E_PORT || 8788);

export default defineConfig({
  ...local,
  use: { ...local.use, baseURL: process.env.FORM_E2E_BASE_URL || `http://127.0.0.1:${port}` },
  // A separate temporary database for each browser test run. No preview data changes.
  webServer: process.env.FORM_E2E_BASE_URL ? undefined : {
    command: 'node scripts/dev-cloudflare.mjs',
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    env: { PORT: String(port), FORM_PREVIEW_STATE: mkdtempSync(join(tmpdir(), 'form-worker-browser-')) },
    timeout: 120_000,
  },
});

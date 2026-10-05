import { defineConfig } from '@playwright/test';
import local from './playwright.config.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  ...local,
  use: { ...local.use, baseURL: process.env.FORM_E2E_BASE_URL || 'http://127.0.0.1:8788' },
  // A separate temporary database for each browser test run. No preview data changes.
  webServer: process.env.FORM_E2E_BASE_URL ? undefined : {
    command: 'node scripts/dev-cloudflare.mjs',
    url: 'http://127.0.0.1:8788/api/health',
    reuseExistingServer: false,
    env: { PORT: '8788', FORM_PREVIEW_STATE: mkdtempSync(join(tmpdir(), 'form-worker-browser-')) },
    timeout: 120_000,
  },
});

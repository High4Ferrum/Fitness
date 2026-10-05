import { defineConfig } from '@playwright/test';
import local from './playwright.config.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  ...local, testDir: './tests/registration', outputDir: './test-results-registration',
  use: { ...local.use, baseURL: process.env.FORM_E2E_BASE_URL || 'http://127.0.0.1:8789' },
  webServer: process.env.FORM_E2E_BASE_URL ? undefined : {
    command: 'node scripts/dev-cloudflare.mjs', url: 'http://127.0.0.1:8789/api/health',
    reuseExistingServer: false, timeout: 120_000,
    env: { PORT: '8789', FORM_SEED_DEMO: '0', TRAIN_SETUP_TOKEN: 'd'.repeat(64), FORM_PREVIEW_STATE: mkdtempSync(join(tmpdir(), 'train-registration-')) },
  },
});

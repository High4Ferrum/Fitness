import { defineConfig } from '@playwright/test';
import local from './playwright.config.mjs';
if (!process.env.FORM_E2E_BASE_URL) throw new Error('Set FORM_E2E_BASE_URL to the deployed demo preview.');
export default defineConfig({
  ...local, testDir: './tests/preview', webServer: undefined,
  use: { ...local.use, baseURL: process.env.FORM_E2E_BASE_URL },
});

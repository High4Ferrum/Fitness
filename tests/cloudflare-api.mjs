// Run the same authorization, validation and persistence contracts in workerd.
process.env.FORM_TEST_RUNTIME = 'cloudflare';
await import('./api.test.mjs');

import { test, expect } from '@playwright/test';

test('published demo supports coach invitations, client registration, Sign out, and saved login', async ({ browser }) => {
  const stamp = Date.now().toString(36), name = `Invited preview ${stamp}`, email = `invite-${stamp}@example.com`, password = 'PreviewRegistration123!';
  const coachContext = await browser.newContext({ baseURL: process.env.FORM_E2E_BASE_URL, timezoneId: 'UTC' });
  const clientContext = await browser.newContext({ baseURL: process.env.FORM_E2E_BASE_URL, timezoneId: 'UTC', viewport: { width: 390, height: 844 } });
  try {
    const coach = await coachContext.newPage();
    await coach.goto('/'); await coach.getByRole('button', { name: 'Coach Plan & guide' }).click();
    await expect(coach.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await expect(coach).toHaveTitle(/Train with me/);
    await coach.getByRole('navigation').getByRole('button', { name: /^My clients/ }).click();
    await coach.getByRole('button', { name: 'Invite client', exact: true }).click();
    const dialog = coach.getByRole('dialog');
    await dialog.getByLabel('Full name').fill(name); await dialog.getByLabel('Email address').fill(email);
    await dialog.getByRole('button', { name: 'Create signup link', exact: true }).click();
    const url = await dialog.getByLabel('Signup link', { exact: true }).inputValue();
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    const client = await clientContext.newPage(); await client.goto(url);
    await client.getByLabel(/^Choose a password/).fill(password); await client.getByLabel('Confirm password', { exact: true }).fill(password);
    await client.getByRole('button', { name: 'Create my account', exact: true }).click();
    await expect(client.getByRole('heading', { name: /Good .*Invited/ })).toBeVisible();
    await expect(client.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await client.getByRole('button', { name: 'Sign out', exact: true }).click();
    await client.getByLabel('Email address').fill(email); await client.getByLabel('Password', { exact: true }).fill(password);
    await client.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(client.getByRole('heading', { name: /Good .*Invited/ })).toBeVisible();
    await client.goto(url); await expect(client.getByRole('alert')).toContainText('no longer available');
    await client.getByRole('button', { name: 'Back to sign in', exact: true }).click();
    await expect(client.getByRole('heading', { name: /Good .*Invited/ })).toBeVisible();
    await coach.reload(); await coach.getByRole('navigation').getByRole('button', { name: /^My clients/ }).click();
    await expect(coach.getByRole('heading', { name, exact: true })).toBeVisible();
  } finally { await coachContext.close(); await clientContext.close(); }
});

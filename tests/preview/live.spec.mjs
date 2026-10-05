import { test, expect } from '@playwright/test';

// This smoke test uses the published sample accounts and leaves a visible,
// uniquely named completed workout as evidence. It does not reset passwords.
test('live admin edits an exercise, coach assigns it, client completes it', async ({ browser }) => {
  const suffix = Date.now().toString(36);
  const exerciseName = `Preview check ${suffix}`;
  const workoutName = `Verified workout ${suffix}`;
  const contexts = [];
  async function role(name) {
    const context = await browser.newContext({ timezoneId: 'UTC', baseURL: process.env.FORM_E2E_BASE_URL });
    contexts.push(context);
    const page = await context.newPage();
    await page.goto('/');
    await page.getByRole('button', { name }).click();
    await expect(page.getByRole('heading', { name: /Good .*\./ })).toBeVisible();
    return page;
  }
  const nav = (page, name) => page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
  try {
    const admin = await role('Admin Curate the library');
    await nav(admin, 'Exercise library');
    await admin.getByRole('button', { name: /Add exercise/ }).click();
    let dialog = admin.getByRole('dialog');
    await dialog.getByLabel('Exercise name').fill(exerciseName);
    await dialog.getByLabel(/Target muscles/).fill('Chest and triceps');
    await dialog.getByLabel(/Instructions/).fill('Place hands against a wall and press with control.');
    await dialog.getByRole('button', { name: 'Add exercise', exact: true }).click();
    await expect(dialog).toBeHidden();
    await admin.getByPlaceholder(/Search exercises/).fill(exerciseName);
    await expect(admin.getByRole('heading', { name: exerciseName })).toBeVisible();
    // Open the exercise and persist an edit using its normal interface.
    await admin.getByRole('heading', { name: exerciseName }).click();
    await admin.getByRole('button', { name: /Edit exercise/ }).click();
    dialog = admin.getByRole('dialog');
    await dialog.getByLabel(/Instructions/).fill('Keep the body straight. Press away from the wall with control.');
    await dialog.getByRole('button', { name: /Save changes/ }).click();
    await expect(dialog).toBeHidden();
    await admin.reload();
    await nav(admin, 'Exercise library');
    await admin.getByPlaceholder(/Search exercises/).fill(exerciseName);
    await admin.getByRole('heading', { name: exerciseName }).click();
    await expect(admin.getByText('Keep the body straight. Press away from the wall with control.')).toBeVisible();

    const coach = await role('Coach Plan & guide');
    await nav(coach, 'Workout plans');
    await coach.getByRole('button', { name: 'Build a workout', exact: true }).click();
    dialog = coach.getByRole('dialog');
    await dialog.getByRole('combobox', { name: 'Client', exact: true }).selectOption('client-jamie');
    await dialog.getByLabel('Workout date').fill(new Date().toISOString().slice(0, 10));
    await dialog.getByLabel('Workout name').fill(workoutName);
    await dialog.getByRole('button', { name: new RegExp(exerciseName) }).click();
    await dialog.getByRole('button', { name: 'Save workout', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(coach.getByRole('heading', { name: workoutName })).toBeVisible();

    const client = await role('Client Train & track');
    await nav(client, 'My workouts');
    const card = client.locator('article').filter({ has: client.getByRole('heading', { name: workoutName }) });
    await card.getByRole('button', { name: 'Log workout' }).click();
    await client.getByRole('dialog').getByRole('button', { name: 'Mark complete', exact: true }).click();
    await expect(client.getByRole('dialog')).toBeHidden();
    await expect(card.getByText('Completed', { exact: true })).toBeVisible();
    await client.reload();
    await nav(client, 'My workouts');
    await expect(client.locator('article').filter({ has: client.getByRole('heading', { name: workoutName }) }).getByText('Completed', { exact: true })).toBeVisible();
    await coach.reload();
    await nav(coach, 'Workout plans');
    await expect(coach.locator('article').filter({ has: coach.getByRole('heading', { name: workoutName }) }).getByText('Completed', { exact: true })).toBeVisible();
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});

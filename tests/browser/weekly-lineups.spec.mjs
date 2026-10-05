import { test, expect } from '@playwright/test';

async function navigate(page) {
  if (await page.getByRole('button', { name: 'Open menu', exact: true }).isVisible()) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: /^(Workout plans|My workouts)$/, exact: true }).click();
}
const mondayInTwoWeeks = () => {
  const date = new Date(); date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7 + 14); return date.toISOString().slice(0, 10);
};

test('daily routines become reusable weekly lineups with independent 2–4 week client assignments', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const suffix = Date.now().toString(36), failures = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Coach Plan & guide', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Good/ })).toBeVisible();
  const clients = [];
  for (const label of ['Four day', 'Three day']) {
    const result = await page.request.post('/api/clients', { data: { name: `${label} ${suffix}`, email: `${label.replaceAll(' ', '-').toLowerCase()}-${suffix}@example.com`, password: 'WeeklyClient123!', equipment: ['Barbell', 'Bench', 'Dumbbells'] } });
    expect(result.status()).toBe(201); clients.push(await result.json());
  }
  await navigate(page);
  await page.getByRole('button', { name: /^Daily routines/ }).click();
  const names = [`Chest & arms ${suffix}`, `Leg day ${suffix}`, `Back & shoulders ${suffix}`];
  for (const [index, exercise] of ['Barbell bench press', 'Bodyweight squat', 'Dumbbell bent-over row'].entries()) {
    await page.locator('.page-heading').getByRole('button', { name: 'Build a workout', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('combobox', { name: 'Client', exact: true })).toHaveValue('');
    await dialog.getByLabel('Workout name').fill(names[index]);
    await dialog.getByRole('button', { name: new RegExp(exercise) }).click();
    await dialog.getByRole('button', { name: 'Save workout', exact: true }).click();
    await expect(dialog).toBeHidden();
  }
  const routineCard = page.locator('.workout-template-library article').filter({ has: page.getByRole('heading', { name: names[0], exact: true }) });
  await routineCard.getByRole('button', { name: 'Duplicate routine', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Workout name')).toHaveValue(names[0] + ' copy');
  await page.getByRole('dialog').getByLabel('Barbell bench press Sets', { exact: true }).fill('5');
  await page.getByRole('dialog').getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const data = await (await page.request.get('/api/bootstrap')).json();
  const ids = names.map(name => data.templates.find(routine => routine.name === name).id);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Weekly lineups/ }).click();
  await page.getByRole('button', { name: 'Build a weekly lineup', exact: true }).first().click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Weekly lineup name').fill(`Four-day split ${suffix}`);
  await dialog.getByLabel('Monday routine', { exact: true }).selectOption(ids[0]);
  await dialog.getByLabel('Tuesday routine', { exact: true }).selectOption(ids[1]);
  await expect(dialog.getByRole('button', { name: 'Save weekly lineup', exact: true })).toBeDisabled();
  await dialog.getByLabel('Thursday routine', { exact: true }).selectOption(ids[2]);
  await dialog.getByLabel('Saturday routine', { exact: true }).selectOption(ids[0]);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Save weekly lineup', exact: true }).click();
  await expect(dialog).toBeHidden();
  const lineupCard = page.locator('.weekly-lineup-card').filter({ has: page.getByRole('heading', { name: `Four-day split ${suffix}`, exact: true }) });
  await expect(lineupCard.getByText('Rest day', { exact: true })).toHaveCount(3);
  await lineupCard.getByRole('button', { name: 'Duplicate lineup', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Weekly lineup name')).toHaveValue(`Four-day split ${suffix} copy`);
  await page.getByRole('dialog').getByRole('button', { name: 'Save weekly lineup', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await lineupCard.getByRole('button', { name: 'Assign to client', exact: true }).click();
  dialog = page.getByRole('dialog');
  const startDate = mondayInTwoWeeks();
  await dialog.getByRole('combobox', { name: 'Client', exact: true }).selectOption(clients[0].id);
  await dialog.getByLabel('Week starting (Monday)', { exact: true }).fill(startDate);
  await dialog.getByRole('combobox', { name: 'Repeat for', exact: true }).selectOption('2');
  await expect(dialog.getByText('8 workouts across 2 weeks', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Assign 8 workouts', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.assigned-lineup')).toContainText('0 / 8 workouts completed');
  await expect(page.locator('.workout-cards article')).toHaveCount(4);
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await expect(page.locator('.workout-cards article')).toHaveCount(4);
  await page.getByRole('button', { name: /^Weekly lineups/ }).click();
  await lineupCard.getByRole('button', { name: 'Assign to client', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Client', exact: true }).selectOption(clients[0].id);
  await dialog.getByLabel('Week starting (Monday)', { exact: true }).fill(startDate);
  await dialog.getByRole('combobox', { name: 'Repeat for', exact: true }).selectOption('2');
  await dialog.getByRole('button', { name: 'Assign 8 workouts', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Existing workouts are kept');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await lineupCard.getByRole('button', { name: 'Assign to client', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Client', exact: true }).selectOption(clients[1].id);
  await dialog.getByLabel('Week starting (Monday)', { exact: true }).fill(startDate);
  await dialog.getByLabel('Saturday routine', { exact: true }).selectOption('');
  await dialog.getByLabel('Monday routine', { exact: true }).selectOption(data.templates.find(routine => routine.name === names[0] + ' copy').id);
  await expect(dialog.getByText('12 workouts across 4 weeks', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Assign 12 workouts', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.assigned-lineup')).toContainText('3 days / week · 4 weeks');
  const after = await (await page.request.get('/api/bootstrap')).json();
  const lineup = after.weeklyLineups.find(lineup => lineup.name === `Four-day split ${suffix}`);
  expect(lineup.days).toHaveLength(4);
  expect(after.plans.filter(plan => plan.clientId === clients[0].id)).toHaveLength(8);
  expect(after.plans.filter(plan => plan.clientId === clients[1].id)).toHaveLength(12);
  const context = await browser.newContext({ baseURL: new URL(page.url()).origin, timezoneId: 'UTC', viewport: { width: 390, height: 844 } });
  try {
    const client = await context.newPage(); client.on('pageerror', error => failures.push(error.message));
    await client.goto('/');
    await client.getByLabel('Email address').fill(clients[1].email);
    await client.getByLabel('Password', { exact: true }).fill('WeeklyClient123!');
    await client.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(client.getByRole('heading', { name: /Good/ })).toBeVisible();
    await navigate(client);
    for (let week = 0; week < 2; week++) await client.getByRole('button', { name: 'Next week', exact: true }).click();
    await expect(client.locator('.assigned-lineup')).toContainText('3 days / week · 4 weeks');
    await expect(client.locator('.workout-cards article')).toHaveCount(3);
    await expect(client.getByRole('button', { name: /^Daily routines/ })).toHaveCount(0);
    await expect(client.locator('article').filter({ has: client.getByRole('heading', { name: names[0] + ' copy', exact: true }) }).getByText('5 × 10 reps · Bodyweight', { exact: true })).toBeVisible();
    for (let week = 0; week < 3; week++) await client.getByRole('button', { name: 'Next week', exact: true }).click();
    await expect(client.locator('.workout-cards article')).toHaveCount(3);
    await expect.poll(() => client.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
  expect(failures).toEqual([]);
});

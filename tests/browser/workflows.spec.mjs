import { test, expect } from '@playwright/test';

async function demo(page, role) {
  await page.goto('/');
  await page.getByRole('button', { name: role==='coach'?'Coach Plan & guide':role==='admin'?'Admin Curate the library':'Client Train & track' }).click();
  await expect(page.getByRole('heading', { name: /Good .*\./ })).toBeVisible();
}
async function navigate(page,name){
 if(await page.getByRole('button',{name:'Open menu',exact:true}).isVisible())await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('navigation').getByRole('button',{name:name==='Workout plans'?/^(Workout plans|My workouts)$/:name,exact:true}).click();
}
const today=()=>new Date().toISOString().slice(0,10);

test('mobile users can see Sign out and switch all demo roles', async ({ page }) => {
 await page.setViewportSize({ width: 390, height: 844 });
 for (const role of ['admin', 'client', 'coach']) {
  await demo(page, role);
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
 }
});

test('admin curates an exercise and creates a coach account',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await demo(page,'admin');
 await navigate(page,'Exercise library');
 await page.getByRole('button',{name:/Add exercise/}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Exercise name').fill('Browser test wall push-up');
 await dialog.getByLabel(/Target muscles/).fill('Chest, triceps');
 await dialog.getByLabel(/Instructions/).fill('Place hands on a wall, bend your elbows, and press away with control.');
 await dialog.getByLabel(/YouTube/).fill('https://www.youtube.com/results?search_query=wall+push+up');
 await dialog.getByRole('button',{name:'Add exercise',exact:true}).click();
 await expect(dialog).toBeHidden();
 await page.getByPlaceholder(/Search exercises/).fill('Browser test wall push-up');
 await expect(page.getByRole('heading',{name:'Browser test wall push-up'})).toBeVisible();
 await navigate(page,'Manage coaches');
 await page.getByRole('button',{name:'Add coach',exact:true}).click();
 await page.getByRole('dialog').getByLabel('Full name').fill('Taylor Browser');
 await page.getByRole('dialog').getByLabel('Email address').fill('taylor-browser@example.com');
 await page.getByRole('dialog').getByLabel('Initial password').fill('BrowserCoach123!');
 await page.getByRole('dialog').getByRole('button',{name:'Add coach',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Taylor Browser'})).toBeVisible();
 expect(errors).toEqual([]);
});

test('coach creates a workout and online session; client completes the workout',async({page,browser})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await demo(page,'coach');
 await navigate(page,'Workout plans');
 await page.getByRole('button',{name:'Build a workout',exact:true}).click();
 let dialog=page.getByRole('dialog');
 await dialog.getByRole('combobox',{name:'Client',exact:true}).selectOption('client-jamie');
 await dialog.getByLabel('Workout date').fill(today());
 await dialog.getByLabel('Workout name').fill('Browser strength session');
 await dialog.getByRole('button',{name:/Barbell bench press/}).click();
 await dialog.getByLabel('Barbell bench press Weight (lb)',{exact:true}).fill('65');
 await dialog.getByRole('button',{name:'Save workout',exact:true}).click();
 await expect(dialog).toBeHidden();
 await expect(page.getByRole('heading',{name:'Browser strength session'})).toBeVisible();
 await navigate(page,'Schedule');
 await page.getByRole('button',{name:'Schedule session',exact:true}).click();
 dialog=page.getByRole('dialog');
 await dialog.getByRole('combobox',{name:'Client',exact:true}).selectOption('client-jamie');
 await dialog.getByLabel('Date',{exact:true}).fill(today());
 await dialog.getByLabel('Start time').fill('18:00');
 await dialog.getByRole('combobox',{name:'Session type',exact:true}).selectOption('Online');
 await dialog.getByLabel('Meeting link').fill('https://meet.google.com/browser-training');
 await dialog.getByRole('button',{name:'Schedule session',exact:true}).click();
 await expect(dialog).toBeHidden();
 const clientContext=await browser.newContext({timezoneId:'UTC'});const clientPage=await clientContext.newPage();
 await demo(clientPage,'client');
 await navigate(clientPage,'Workout plans');
 const card=clientPage.locator('article').filter({has:clientPage.getByRole('heading',{name:'Browser strength session'})});
 await card.getByRole('button',{name:'Log workout'}).click();
 await clientPage.getByRole('dialog').getByLabel('Barbell bench press Weight (lb)',{exact:true}).fill('70');
 await clientPage.getByRole('dialog').getByRole('button',{name:'Mark complete',exact:true}).click();
 await expect(clientPage.getByRole('dialog')).toBeHidden();
 await expect(card.getByText('Completed',{exact:true})).toBeVisible();
 await clientPage.reload();
 await navigate(clientPage,'Progress & assessments');
 await expect(clientPage.getByText('+30 lb since first log')).toBeVisible();
 await page.reload();await navigate(page,'Workout plans');
 const updated=page.locator('article').filter({has:page.getByRole('heading',{name:'Browser strength session'})});
 await expect(updated.getByText('Completed',{exact:true})).toBeVisible();
 await updated.getByRole('button',{name:'View results'}).click();
 await expect(page.getByRole('dialog').getByText(/70 lb/)).toBeVisible();
 expect(errors).toEqual([]);await clientContext.close();
});

test('client saves equipment and measurements; BMI and ratio update',async({page})=>{
 await demo(page,'client');await navigate(page,'Equipment');
 const dumbbells=page.getByRole('button',{name:/Dumbbells/});
 const initiallySelected=await dumbbells.getAttribute('aria-pressed');await dumbbells.click();
 await page.getByRole('button',{name:'Save equipment',exact:true}).click();
 await expect(page.getByRole('button',{name:'Save equipment',exact:true})).toBeDisabled();
 await page.reload();await navigate(page,'Equipment');
 await expect(page.getByRole('button',{name:/Dumbbells/})).toHaveAttribute('aria-pressed',initiallySelected==='true'?'false':'true');
 await navigate(page,'Progress & assessments');
 await page.getByRole('button',{name:'Record measurements',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByLabel(/Height/).fill('180');await dialog.getByLabel(/Weight/).fill('81');
 await dialog.getByLabel(/Waist/).fill('80');await dialog.getByLabel(/Hip/).fill('100');
 await dialog.getByRole('button',{name:'Save measurements',exact:true}).click();
 await expect(dialog).toBeHidden();
 await expect(page.locator('.pg-stat').filter({hasText:'Body mass index'}).getByText('25.0',{exact:true})).toBeVisible();
 await expect(page.locator('.pg-stat').filter({hasText:'Waist-to-hip ratio'}).getByText('0.80',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Add',exact:true})).toHaveCount(0);
 await expect(page.getByRole('navigation').getByRole('button',{name:'Manage coaches'})).toHaveCount(0);
});

test('coach records baseline assessments and changes password',async({page})=>{
 await demo(page,'coach');await navigate(page,'Progress & assessments');
 await page.getByRole('button',{name:'Add',exact:true}).click();
 let dialog=page.getByRole('dialog');
 await dialog.getByLabel('Assessment name').fill('Browser push-up assessment');
 await dialog.getByLabel('Result',{exact:true}).fill('18');
 await dialog.getByRole('button',{name:'Save assessment',exact:true}).click();
 await expect(dialog).toBeHidden();await expect(page.getByRole('heading',{name:'Browser push-up assessment'})).toBeVisible();
 await page.getByTitle('Account settings').click();dialog=page.getByRole('dialog');
 await dialog.getByLabel('Current password').fill('FormDemo123!');
 await dialog.getByLabel(/^New password/).fill('FormCoachChanged123!');
 await dialog.getByLabel('Confirm new password').fill('FormCoachChanged123!');
 await dialog.getByRole('button',{name:'Change password'}).click();await expect(dialog).toBeHidden();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await page.getByLabel('Email address').fill('coach@form.fit');await page.getByLabel('Password',{exact:true}).fill('FormCoachChanged123!');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:/Good/})).toBeVisible();
});

test('mobile navigation and every client page fit the viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await demo(page,'client');
 for(const name of ['Overview','Workout plans','Schedule','Exercise library','Progress & assessments','Equipment']){
  await navigate(page,name);await expect(page.getByRole('button',{name:'Open menu'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

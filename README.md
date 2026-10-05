# Train with me

A personal-training app for admins, coaches, and clients. The existing React/TypeScript interface is preserved. The same validated API runs locally on Express/SQLite and on Cloudflare Workers with persistent SQLite storage in a Durable Object.

**Your app:** [train-with-me.highferrum.workers.dev](https://train-with-me.highferrum.workers.dev)

**Separate demo:** [form-fitness-preview.highferrum.workers.dev](https://form-fitness-preview.highferrum.workers.dev)

Choose Admin, Coach, or Client on the sign-in screen to explore the sample workspace. The published preview uses sample data and is separate from the production configuration.

## Start your coaching workspace

Use the private activation guide provided with the deployment to create your own administrator account. Choose your name, email and password. The link works only until the first account is created. The real workspace starts with 19 library exercises and no demo accounts, clients, workouts or measurements. The demo uses a separate database.

You can coach clients directly as the administrator, or add coach accounts under **Manage coaches**.

## Client registration

1. Open **My clients → Invite client**.
2. Enter the client’s name, email and goal. Administrators can choose the assigned coach.
3. Create and copy the signup link, then send it to that client yourself. The app does not send email automatically.
4. The client opens the link, chooses their password, and joins the assigned coach.
5. Assign workouts and sessions. Clients record completed workouts, equipment and measurements.

Links expire after seven days and work once. Pending invitations can be revoked. Creating another invitation for the same email and coach replaces their previous link. Only the assigned coach and administrators can manage that invitation. Registration cannot choose an administrator role or another email or coach. Invitation tokens are stored only as hashes.

**Sign out** is a visible button at the top of every workspace, including on mobile. In the demo, sign out to return to the Admin/Coach/Client choices.

## Run locally

Install Node.js 24 or newer, open this folder, then run:

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. The API uses port 3001 and creates `data/form.sqlite` on the first start. Changes persist across refreshes and restarts. After `npm run build`, `npm start` serves the compiled frontend and API together on port 3001.

To preview the Cloudflare backend locally instead:

```sh
npm run dev:cloudflare
```

Open **http://127.0.0.1:8787**. This uses Cloudflare's `workerd` runtime through Miniflare, with a persistent local database under `.wrangler/state/form-local`. Its asset binding serves the built frontend from `dist`. This local database is separate from the deployed preview.

## Sample accounts

| Role | Email | Demo password |
| --- | --- | --- |
| Admin | admin@form.fit | FormDemo123! |
| Coach | coach@form.fit | FormDemo123! |
| Client, Jamie Chen | jamie@form.fit | FormDemo123! |

Maya, Chris, and Jordan also have sample client accounts using their first name at `form.fit`, with the same demo password. These are public evaluation accounts.

## Features

- **Admin:** add, edit and archive exercises; write instructions and cues; tag equipment; choose video links and alternatives; provision coaches; reset staff passwords; reassign clients.
- **Coach:** create client accounts, update goals, build weekly workouts, check equipment and alternatives, schedule online or in-person sessions, record assessments, and review progress.
- **Client:** view assigned workouts and sessions, record actual sets/repetitions/load and notes, complete workouts, update equipment, and record body measurements.
- **Progress:** strength history, completion history, assessments, BMI, and waist-to-hip ratio.
- **Access:** server-enforced roles and client ownership. Coaches see their assigned clients. Clients see their own records. Passwords use salted scrypt hashes. Sessions use hashed tokens and HttpOnly/SameSite cookies; password resets revoke sessions.

Archived exercises remain readable in historical records. Completed workout prescriptions cannot be edited or deleted. Scheduling rejects overlaps for the client or their coach. Account and client-profile changes use atomic transactions.

Exercise loads use **pounds**. Body measurements use **kilograms and centimeters**. Session times use the coach's agreed local clock. Calendar-provider integration and automatic timezone conversion are not included. The starter library lives in your database; its sample YouTube search links can be replaced with selected demonstration videos by an admin.

## Deploy to Cloudflare

The preview is a complete Worker with frontend assets, API, authentication, and persistent storage. It uses Cloudflare's default `workers.dev` domain. Deployment commands do not configure custom domains or zone routes.

```sh
npm ci
npx wrangler login
npm run deploy:preview
```

The `preview` environment deploys `form-fitness-preview` with demo seeding enabled. Its `FormDatabase` Durable Object owns the SQLite database. Keep the class name, migration history, and object name stable to retain data across deployments. Preview and production have separate Worker namespaces and databases.

Worker source is bundled with Rollup using native Node modules. `wrangler.jsonc` defines assets, storage bindings, the initial SQLite class migration, secure cookies, and observability. No account credentials are stored in source.

### Direct-upload alternative

Some restricted Windows environments prevent Wrangler's native build tool from reading parent directories. `scripts/deploy-direct.mjs` uses Cloudflare's documented asset and script upload APIs for the same preview Worker. Supply `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` securely through the shell, then run `npm run deploy:preview:direct`.

Alternatively, `FORM_WRANGLER_AUTH_FILE` can point to an existing Wrangler OAuth credential file. The script reads the credential in memory and never logs it. Without arguments it updates the demo. `npm run deploy:direct` deploys the real `train-with-me` workspace; the first upload requires `FORM_PRODUCTION_SECRET_FILE` pointing to a private JSON file containing only a random `TRAIN_SETUP_TOKEN`. Keep that file outside the repository. Subsequent uploads preserve secret bindings and the existing database migration.

### Production configuration

The default `train-with-me` Worker configuration uses `FORM_SEED_DEMO=0`. Set a random 64-character hexadecimal `TRAIN_SETUP_TOKEN` using `wrangler secret put`, then deploy with `npm run deploy`. The first administrator opens the app with `/#setup=TOKEN` and chooses their own credentials. The setup endpoint closes permanently after the first account is created. Demo shortcuts are hidden. Alternatively, `FORM_ADMIN_EMAIL`, `FORM_ADMIN_PASSWORD` and optional `FORM_ADMIN_NAME` can bootstrap an administrator through environment secrets. Changing the seeding flag does not remove data or accounts from an existing demo database.

For the local Express backend, use the corresponding environment variables: `FORM_SEED_DEMO=0`, `FORM_ADMIN_EMAIL`, `FORM_ADMIN_PASSWORD`, optional `FORM_ADMIN_NAME`, `FORM_COOKIE_SECURE=1` behind HTTPS, and optional exact trusted `FORM_ALLOWED_ORIGINS`. `FORM_DB_PATH` selects the database file and `PORT` selects the API port.

## Validation

```sh
npm run build
npm test
npm run test:cloudflare
npm run test:e2e
npm run test:e2e:cloudflare
npm run test:e2e:registration
```

The 20 API contracts run against both Express and the real Cloudflare runtime: authentication, role and ownership restrictions, exercise management, coaching, scheduling, progress, password changes, request validation, and persistence after a restart. Each test uses isolated storage.

The six demo browser workflows cover admin library/account management, coach assignment and client completion, equipment/measurements, assessments/password changes, and mobile layouts. Windows/macOS use an installed Chrome browser; Linux uses the bundled Chromium package. Browser tests use UTC to keep date-only test inputs consistent at timezone boundaries. The Cloudflare browser suite uses a separate temporary database. The private-registration browser suite covers first-owner activation, an invited client choosing their password, workout assignment and completion, mobile sign-out, and signing back in to saved data.

To verify an already deployed demo preview, set `FORM_E2E_BASE_URL` and run `npx playwright test --config playwright.preview.config.mjs`. This checks sign-in for all three roles, admin exercise editing, coach workout assignment, client completion, and persistence after reload. A second live check covers coach invitations, client self-registration, visible sign-out, saved login and rejected reuse of a consumed invitation. It creates uniquely named sample records and preserves the demo passwords.

## Project layout

- `src/`: existing responsive app and role-specific components.
- `server/api.mjs`: shared validation, permissions, authentication and data rules.
- `server/index.mjs`: Express/local SQLite adapter and production frontend serving.
- `server/seed.mjs`: starter movements and sample workspace.
- `cloudflare/`: Fetch adapter, Durable Object SQL adapter and Worker entrypoint.
- `scripts/`: Worker bundling, local Cloudflare preview and direct deployment.
- `tests/`: shared API tests, browser workflows and live preview smoke test.
- `.github/workflows/ci.yml`: build and isolated API/browser validation.

Billing, email invitations, forgotten-password email delivery, reminders, and video-meeting creation are outside this version.

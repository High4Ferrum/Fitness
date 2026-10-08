# Train with me

A personal-training app for admins, coaches, and clients. The existing React/TypeScript interface is preserved. The same validated API runs locally on Express/SQLite and on Cloudflare Workers with persistent SQLite storage in a Durable Object.

**Your app:** [train-with-me.highferrum.workers.dev](https://train-with-me.highferrum.workers.dev)

**Separate demo:** [form-fitness-preview.highferrum.workers.dev](https://form-fitness-preview.highferrum.workers.dev)

Choose Admin, Coach, or Client on the sign-in screen to explore the sample workspace. The published preview uses sample data and is separate from the production configuration.

## Start your coaching workspace

Use the private activation guide provided with the deployment to create your own administrator account. Choose your name, email and password. The link works only until the first account is created. The real workspace starts with 353 library exercises and no demo accounts, clients, workouts or measurements. The demo uses a separate database.

You can coach clients directly as the administrator, or add coach accounts under **Manage coaches**.

## Client registration

1. Open **My clients → Invite client**.
2. Enter the client’s name, email and goal. Administrators can choose the assigned coach.
3. Create and copy the signup link, then send it to that client yourself. The app does not send email automatically.
4. The client opens the link, chooses their password, and joins the assigned coach.
5. Assign workouts and sessions. Clients record completed workouts, equipment and measurements.

Links expire after seven days and work once. Pending invitations can be revoked. Creating another invitation for the same email and coach replaces their previous link. Only the assigned coach and administrators can manage that invitation. Registration cannot choose an administrator role or another email or coach. Invitation tokens are stored only as hashes.

**Sign out** is a visible button at the top of every workspace, including on mobile. In the demo, sign out to return to the Admin/Coach/Client choices.

## Reusable workouts and assessments

Admins and coaches can build before adding clients. Open **Workout plans → Daily routines → Build a workout**, choose **Daily routine library · assign later**, add exercises and save. These reusable routines need no client or date. Coaches manage their own library; administrators can manage all libraries.

Open **Daily routines → Copy to client**, choose the client and date, then copy. Sets, repetitions, loads, rest, exercise notes and workout notes are copied into an independent plan. **Duplicate routine** starts a variation with the same exercises and prescriptions. Assigned and completed workouts also have **Copy to client** and **Save to library** controls; copies include the prescription, without completed results. Archived exercises must be replaced before making a new assignment.

## Three levels of workout planning

The exercise catalog includes 19 original movements plus 20 ISSA selections and 9 additional selections from the earlier NASM/ACE research, with overlaps included once. New entries include equipment, target muscles, difficulty, original instructions, coaching cues, alternatives and coach reference links. ISSA reference links open the trainer portal and may require sign-in. Third-party videos, photos and course text are not copied into the app; the YouTube control searches for demonstrations. Administrators can replace that search link with a selected video.

The supplied `train_with_me_starter_exercise_database.xlsx` adds 305 distinct movements for a total of 353. All 350 spreadsheet rows and their original metadata are retained in `server/starter-exercises.mjs`; `server/starter-exercise-definitions.mjs` maps them to the existing app format and resolves equivalent names. Existing entries keep their IDs, instructions, edits and archive status. Spreadsheet-only entries have no supplied coaching instructions or video URLs; instructions remain blank and demonstration links use the existing YouTube search. Administrators can add coaching text and selected videos. Equipment labels are normalized, with bench/rack requirements added for relevant movements. Spreadsheet metadata beyond the current app fields is retained in the source module for future use.

Catalog upgrades add missing exercises to existing workspaces when the API starts. Existing edits, archived exercises, custom movements and assigned workouts remain intact. A custom exercise with the same name (ignoring case, extra spaces and hyphens) is reused instead of adding a duplicate.

1. **Exercise library:** individual movements, instructions, equipment and alternatives.
2. **Daily routines:** named combinations such as Chest day, Leg day, Back day, or Chest & arms. Set each exercise's sets, repetitions, weight, rest and notes. Build or duplicate routines without a client.
3. **Weekly lineups:** open **Workout plans → Weekly lineups → Build a weekly lineup**. Choose a daily routine for 3–5 weekdays and leave the remaining days as rest days. Save, edit or duplicate the lineup for different training splits.

To assign a lineup, choose **Assign to client**, select the client and a starting Monday, then choose **2, 3 or 4 weeks**. Review the exact dates before saving. You can swap daily routines and training days for this client without changing the saved lineup, provided the week still has 3–5 training days. For example, a four-day lineup repeated for four weeks creates 16 dated workouts.

**Client calendar** opens the first assigned week and shows the program dates and total completion count. Clients see their own program and dated workouts under **My workouts**; week arrows move through all assigned weeks. Each dated workout is an independent copy that can be adjusted for that client. Changes to saved daily routines or weekly lineups apply to future assignments and leave existing client workouts intact. Existing workouts on selected training dates cause an overlap message; the assignment saves no partial workouts. Choose different weeks or adjust the training days to proceed.

A daily routine used in a saved weekly lineup cannot be deleted until it is replaced in that lineup or the lineup is removed. Removing a weekly lineup keeps all previously assigned client workouts and program records. To extend a program, assign the same lineup again starting on the Monday after its final week.

**Schedule session** requires a client assigned to the coach (or any client for an administrator). Add or invite that client from **My clients** first. The empty schedule explains this requirement.

Under **Progress & assessments**, select a client and use **Body fat %** to record a measured body fat percentage, date and optional measurement method in Notes. Percent values must be from 0 to 100. The latest recorded value appears in the progress cards; all readings remain in assessment history and are visible to that client.

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
- **Progress:** strength history, completion history, assessments, body fat percentage, BMI, and waist-to-hip ratio.
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

The 30 API contracts run against both Express and the real Cloudflare runtime: authentication, role and ownership restrictions, exercise management, coaching, scheduling, progress, password changes, request validation, and persistence after a restart. A separate upgrade test verifies catalog additions in an existing 19-exercise database with custom entries and archives. Each test uses isolated storage.

The eight demo browser workflows cover admin library/account management, expanded-library search and routine building, weekly programs, coach assignment and client completion, equipment/measurements, assessments/password changes, and mobile layouts. Windows/macOS use an installed Chrome browser; Linux uses the bundled Chromium package. Browser tests use UTC to keep date-only test inputs consistent at timezone boundaries. The Cloudflare browser suite uses a separate temporary database. The private-registration browser suite covers first-owner activation, an invited client choosing their password, workout assignment and completion, mobile sign-out, and signing back in to saved data.

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

## Yoga classes

Coaches and administrators can open **Yoga → Flow Builder**, **Pose Library**, and **Reusable Blocks**. The additive upgrade includes 126 poses, 12 complete 25–55-minute draft classes and seven sequence blocks. Duplicate a starter, customize sections and steps, preview, publish and assign it to a client. Clients see only assigned published copies under **My yoga**, with a timed player and completion history. The Exercise Library is hidden from clients; assigned exercise demonstrations remain available.

See [Yoga implementation and migration guide](docs/yoga-enhancement.md) for components, APIs, timing rules, sources, rollback and review steps.

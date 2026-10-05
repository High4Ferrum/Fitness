# Train with me continuation checkpoint

The original React fitness app has been continued and renamed. The frontend, Express backend and Cloudflare Worker share the same account, permission and training rules.

## Deployed apps

- Real workspace: https://train-with-me.highferrum.workers.dev
- Separate shared demo: https://form-fitness-preview.highferrum.workers.dev
- GitHub: https://github.com/High4Ferrum/Fitness

Both use Cloudflare workers.dev domains. No custom domain routes are configured. Each Worker has its own SQLite-backed FormDatabase Durable Object; names and migration v1 must remain stable to preserve data. Internal FORM environment names and the form_session cookie are kept for compatibility.

## Accounts and registration

The real workspace has demo seeding disabled. A private one-time activation guide outside this repository lets the owner choose their administrator credentials. The setup secret is stored as a Cloudflare secret; nobody can claim the first account without that link. After the first account exists, setup is disabled. Only exercises are seeded for that real workspace.

Coaches or administrators create client invitation links on My clients. Links expire after seven days, have one use, bind an email and coach, and are stored as hashes. Clients choose their own passwords. Pending invitations can be revoked; issuing a replacement for the same coach/email invalidates the previous link. Link sharing is manual. Direct coach-created accounts remain available under Add client.

The text Sign out button is always in the top bar and returns the demo to the role choices. Signing out invalidates its server-side session. Hash-link navigation works in already-open app tabs.

## Reusable workouts and body fat assessments

Admins and coaches can build without clients by choosing Daily routine library · assign later. The Daily routines view uses the additive workout_templates table for date-free/client-free prescriptions with an immutable ownerId. Coaches access their own library; administrators access all. Clients receive no templates in bootstrap and cannot mutate or assign them. Duplicate routine creates an editable independent variation.

Copy to client assigns an independent plan from a template or existing client plan, keeping all prescriptions and notes without completion logs. Save to library copies an existing plan into the caller's library. Editing/deleting a template leaves existing client copies intact. New assignments validate active exercises and target client access. Session scheduling still requires a client, with visible guidance for empty workspaces.

Body fat % is a fitness assessment with the canonical name Body fat percentage and % unit. The server validates the unit and 0–100 bounds. Progress displays the latest measured value and retains the full assessment history; clients can read their own results. No body fat estimate is calculated from BMI or measurements.

## Exercise → daily routine → weekly lineup

Workout plans has Client calendar, Daily routines and Weekly lineups tabs. The existing exercise library forms the base level. The additive weekly_lineups table stores immutable ownerId, name, notes and days [{weekday,templateId}], where Monday=0 through Sunday=6. Validate 3–5 distinct training weekdays. Rest days have no entry. Routines are live references for future assignments; daily deletion is blocked while any saved lineup references it. Coaches can use their own routines only. Administrators can manage all, but edits to a coach-owned lineup must retain routines accessible to that coach.

POST/PATCH/DELETE /api/weekly-lineups follow the same staff ownership rules as daily templates. POST /api/weekly-lineups/:id/assign accepts clientId, startDate (Monday), weeks (integer 2–4), and optional days for a client variation. Resolve and validate every routine and dated plan first. Any existing client plan on a selected training date returns 409 without writing anything. Save all dated plans and the weekly_assignments record in one transaction. Date arithmetic uses UTC calendar dates, including DST/year crossings.

weekly_assignments stores clientId, lineupId, lineupName, notes, startDate, weeks, day/name snapshots and createdAt. Assigned plans contain weeklyAssignmentId. Bootstrap filters assignments through client access; clients receive their own assignments and no weekly templates. Plan edits preserve program membership and cannot move that plan to another client; Copy to client makes an unlinked copy. Editing or deleting daily/weekly source templates leaves assigned prescriptions and assignment history intact. Client calendar shows the program date range, frequency, duration and total completion count. Assignment dialogs show every week/date and support per-client swaps without modifying the saved lineup.

## Verification

- TypeScript/Vite/Rollup build.
- 29 API contracts on Express, and the same 29 on workerd, including weekly repetition, snapshots, atomic overlap rejection, validation, and ownership.
- Seven demo browser workflows, including mobile daily/weekly building, duplication, 2/4-week assignment, client variations and client calendar visibility.
- Full isolated production browser flow: owner setup → admin and coach building with zero clients → weekly lineup saving without clients → client registration → template copying → independent editing → workout completion → sign-out → saved login → completed workout copying → body fat recording and client visibility.
- Deployed demo smoke tests include registration and training workflows.
- Real deployed configuration and protected record access checked without consuming the owner’s activation link.

Use npm run dev:cloudflare for the local app. Read README.md for deployment, setup, registration and tests. Credentials and activation guides are outside source and must never be uploaded to GitHub.

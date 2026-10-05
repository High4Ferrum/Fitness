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

Admins and coaches can build without clients by choosing Workout library · assign later. The additive workout_templates table stores date-free/client-free prescriptions and an immutable ownerId. Coaches access their own library; administrators access all. Clients receive no templates in bootstrap and cannot mutate or assign them.

Copy to client assigns an independent plan from a template or existing client plan, keeping all prescriptions and notes without completion logs. Save to library copies an existing plan into the caller's library. Editing/deleting a template leaves existing client copies intact. New assignments validate active exercises and target client access. Session scheduling still requires a client, with visible guidance for empty workspaces.

Body fat % is a fitness assessment with the canonical name Body fat percentage and % unit. The server validates the unit and 0–100 bounds. Progress displays the latest measured value and retains the full assessment history; clients can read their own results. No body fat estimate is calculated from BMI or measurements.

## Verification

- TypeScript/Vite/Rollup build.
- 24 API contracts on Express, and the same 24 on workerd.
- Six demo browser workflows, including role switching and mobile sign-out.
- Full isolated production browser flow: owner setup → admin and coach building with zero clients → client registration → template copying → independent editing → workout completion → sign-out → saved login → completed workout copying → body fat recording and client visibility.
- Deployed demo smoke tests include registration and training workflows.
- Real deployed configuration and protected record access checked without consuming the owner’s activation link.

Use npm run dev:cloudflare for the local app. Read README.md for deployment, setup, registration and tests. Credentials and activation guides are outside source and must never be uploaded to GitHub.

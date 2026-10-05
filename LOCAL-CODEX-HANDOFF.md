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

## Verification

- TypeScript/Vite/Rollup build.
- 20 API contracts on Express, and the same 20 on workerd.
- Six demo browser workflows, including role switching and mobile sign-out.
- Full isolated production browser flow: owner setup → coach invitation → client registration → workout assignment → completion → sign-out → saved login.
- Deployed demo smoke tests include registration and training workflows.
- Real deployed configuration and protected record access checked without consuming the owner’s activation link.

Use npm run dev:cloudflare for the local app. Read README.md for deployment, setup, registration and tests. Credentials and activation guides are outside source and must never be uploaded to GitHub.

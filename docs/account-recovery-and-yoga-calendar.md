# Account recovery and yoga calendar updates

The existing React, shared Node/Worker API, authentication, calendar and yoga entities are extended in place. Existing exercise and yoga records remain intact.

## Password recovery

Login includes **Forgot password?**. Email delivery is intentionally deferred until the owner selects a verified sender/domain. Until then, the screen directs users to their coach or administrator.

Coaches: My clients → **Create password reset link**. Administrators can also create staff recovery links in Manage coaches. Verify the account owner's identity and share the link privately. Users choose their own new password; coaches never need to know it. Links expire after 30 minutes, are single-use and replaced by a newly generated link. Tokens are cryptographically random; only their SHA-256 hashes are stored. Resetting revokes all account sessions. Normal password changes and administrator password resets also invalidate outstanding recovery links.

Public API: POST `/api/auth/forgot-password`, GET `/api/auth/reset-password/:token`, POST `/api/auth/reset-password`. Authenticated POST `/api/auth/recovery-link` enforces administrator access for staff and coach ownership for clients. The email request endpoint is rate limited and does not disclose account existence.

Future email setup: configure a verified Cloudflare Email Sending domain, an `EMAIL` send_email binding, `FORM_EMAIL_FROM` and `FORM_PUBLIC_URL` (the canonical HTTPS website URL). The shared API supports the binding; the Fetch router now awaits async handlers. Do not add credentials to source control. No email messages or domain changes were made during this delivery.

Schema: additive idempotent `server/migrations/password-recovery-v1.mjs` creates password_resets and indexes. No existing tables or records are removed.

## Calendar yoga assignments

Schedule → **Add yoga class** selects an entire published sequence, client and calendar date. Flow Builder → **Assign to Trainee** also has a calendar date. Assignments retain the existing immutable published-flow and pose-guidance snapshot, with an optional validated YYYY-MM-DD date. Existing undated assignments remain available under My yoga. An additive JSON date index is created on yoga_assignments. Calendar views and counts include dated yoga classes; clients can start and complete them from the daily agenda.

API POST `/api/yoga/flows/:id/assign` accepts `{ clientId, date }`. Omitting date retains compatibility with previous assignments. Impossible dates, unauthorized coaches and trainees, drafts and inactive poses are rejected.

## Player

A running countdown advances to the next step automatically after its full duration, including bilateral holds, repetitions, transitions and rests. Playback continues on the next step. Pause/resume and manual previous/next remain available. The final step stops at zero and leaves completion as an explicit user action.

## Changed components

PasswordRecovery (new), App, Registration, Clients, Accounts, Schedule, Yoga, YogaFlowEditor, YogaPlayer; yoga-types; shared API and Yoga API; Cloudflare Fetch router; additive recovery migration. API and browser contracts cover authorization, replacement/single-use tokens, session revocation, calendar assignment and automatic progression/pause/final-stop.

## Verification and production delivery (2026-10-08)

- Production build passed.
- Node automated suite: 40 passed.
- Shared Cloudflare API contracts: 36 passed; additional Node test verifies token expiry and restart persistence.
- Full desktop/mobile browser suite: 13 passed.
- New calendar, timer and recovery browser contracts also passed against Cloudflare: 2 passed.
- Source commit: 9089728, pushed to feature/yoga-flow-builder (existing PR #2).
- Deployed to https://train-with-me.highferrum.workers.dev at 100% traffic.
- Worker version: c27a03bc-fad7-4926-993f-577a1ddc75bb; deployment: 3d365df7-6ef7-4fcd-9fe7-aa339545dce2.
- Existing FormDatabase namespace 62cb0723d84d4ca38888f4e070eb82a2, migration tag v1 and setup secret binding preserved. Previous version 0f5c6e7c-5c60-4e14-8d44-476b3bc544d8 remains available for rollback.
- Email sender/domain setup remains deferred by the owner. Private recovery links are available now.
- Production authenticated workflows were tested in isolated local and Cloudflare environments; no real user accounts were modified for testing.

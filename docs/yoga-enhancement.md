# Yoga library and flow builder

Extends the existing React/TypeScript application, Express/SQLite API, and Cloudflare FormDatabase Durable Object. Authentication, workout schemas, Worker namespace, existing records, and styling conventions remain intact. No new UI dependencies.

## Navigation and components

- Coach/admin: **Yoga → Flow Builder / Pose Library / Reusable Blocks**. Clients: **My yoga**.
- `src/App.tsx` hides Exercise Library from clients and guards its rendering. Clients still receive the exact demonstrations needed by assigned workouts.
- `Yoga.tsx`: flow cards, search/style/duration/difficulty/status filters, duplication, publication, assignment history, trainee assigned classes.
- `YogaFlowEditor.tsx`: editable class metadata, expandable sections, drag handles, keyboard moves, step edits/copies/deletion, multi-pose insertion, reusable blocks, reliable explicit saving, unsaved-change prompts, duration comparison, preview and assignment.
- `YogaSelection.tsx`: ordered multiple selection, aliases and category/position/difficulty filtering; full-screen mobile dialog.
- `YogaPoseLibrary.tsx`: searchable/filterable catalog, complete pose editing and active status.
- `YogaBlocks.tsx`: reusable block create/edit/duplicate/delete with independent inserted steps.
- `YogaPlayer.tsx`: class intention, ordered steps and sections, pose media placeholders, guidance, phases for holds/breaths/each side/round/transitions/rest, countdown, pause/resume, next/previous, progress and trainee completion.
- `YogaStepEditor.tsx`, `YogaShared.tsx`, `Yoga.css`, `src/yoga-types.ts`: shared fields, badges, timing labels, responsive styles and types. Existing Modal provides focus trapping and Escape support.

The app uses its existing state-based page navigation, not a new routing framework. Yoga API routes below are protected even when called directly. Clients cannot enumerate pose or exercise libraries, flow templates or blocks.

## Database migration and safety

`server/migrations/yoga-v1.mjs` applies an additive, transactional, repeatable schema upgrade on API initialization in both runtimes. Creates:

- `yoga_poses`: unique normalized English name and validated pose JSON.
- `yoga_flows`: immutable coach owner, starter identity, status, timestamp, metadata.
- `yoga_sections`: flow FK, order and title.
- `yoga_steps`: section OR block FK, nullable pose FK for breathing/rest, order and independently validated prescription. Repeated occurrences have distinct step IDs.
- `yoga_blocks`: coach owner and reusable ordered templates.
- `yoga_assignments`: flow/client/assigning-user FKs and immutable snapshot of published metadata, sequence and necessary pose guidance.
- `yoga_completions`: assignment/client FKs and unique assignment completion, idempotent completion action.
- `yoga_migrations`, `yoga_seed_history`: migration tracking and preservation of intentionally deleted starter templates.

Indexes support coach/status, section/step ordering, pose references and trainee assignments. Existing exercises, users, workouts, logs and assignments are never migrated or deleted. Libraries are private inside the authenticated API/database adapters; SQL storage has no publicly accessible query endpoint. Existing exercise mutations remain administrator-only, matching the prior application; coaches can browse the exercise library and manage yoga poses.

Rollback: redeploy the previous application build **while retaining the additive yoga tables**. The previous app ignores them, and restoring this build resumes yoga history. Do not delete or reset the existing Durable Object, its namespace, object name (`form-database-v1`), or Wrangler migration history. Back up local SQLite before deploying; use the platform's database recovery procedure for production. No destructive down migration is run.

## API routes

Authenticated coach/admin catalog/template routes:

| Route | Methods | Purpose |
|---|---|---|
| `/api/exercises` | GET | Coach/admin full catalog |
| `/api/exercises/:id` | GET | Coach/admin details; trainee only when included in their assigned workout |
| `/api/yoga/poses` | GET, POST | Catalog and pose creation |
| `/api/yoga/poses/:id` | PATCH, DELETE | Edit / mark inactive |
| `/api/yoga/flows` | GET, POST | Owned flows plus shared starters / create |
| `/api/yoga/flows/:id` | GET, PATCH, DELETE | Read / owned edit / safe delete |
| `/api/yoga/flows/:id/duplicate` | POST | Independent owned draft copy |
| `/api/yoga/flows/:id/assign` | POST | Published snapshot for an authorized trainee |
| `/api/yoga/blocks` | GET, POST | Blocks / create |
| `/api/yoga/blocks/:id` | PATCH, DELETE | Owned management |
| `/api/yoga/assignments` | GET | Only authorized trainees' assignments |
| `/api/yoga/assignments/:id` | GET | Ownership-protected published snapshot |
| `/api/yoga/assignments/:id/complete` | POST | Assigned trainee completion only |
| `/api/yoga/completions` | GET | Authorized completion history |

Starter templates have no user owner and are readable by coaches. Coaches duplicate them to create owned copies; admins can review/edit the shared starters. Coaches cannot access another coach's flows or blocks. Assignment checks both flow ownership and the existing client/coach relationship. Editing a template or pose never changes prior assignments. Assigned flows cannot be deleted. Inactive poses remain in history but cannot be newly prescribed or assigned.

## Timing contract

Shared implementation: `shared/yoga-timing.mjs`, used by API, frontend and tests.

`(hold seconds + transition seconds + rest seconds) × repetitions × sides`

Breath holds: `breath count × seconds per breath`. Sides = 2 for Both, otherwise 1. Transitions/rest are **per hold, per side, per round**. Whole-step overrides replace the complete result, explicitly labeled in the editor/player. Inserting a block repeats its full ordered sequence, rather than each pose in isolation. No hidden padding or flow-level override is used. Publication requires actual 25–55-minute calculated time and no empty sections. Drafts can be incomplete.

The 45-minute sample totals **300 / 480 / 1020 / 600 / 300 seconds**. Sun Salutations expand to actual pose records. Warrior, pigeon and twist holds are bilateral. Breathwork, repeated movements, transitions and rest are explicit records/fields.

## Initial content and attribution

`server/yoga-seed.mjs`: 126 unique canonical poses/explicit supported variations, 12 original full draft classes, seven reusable blocks. Startup seeding is idempotent and preserves edits, inactive statuses, custom poses and intentionally deleted templates. English/Sanskrit names, aliases, categories, position, difficulty, target areas, props, breath/alignment/modification/safety guidance are provided. Chinese names and media URLs remain optional and blank. Images/video placeholders use original interface graphics; no third-party media downloads.

Research references are stored on each class and shown to coaches. Sources include [Cleveland Clinic sun salutations](https://health.clevelandclinic.org/sun-salutation), [foundational pose names](https://www.yogajournal.com/practice/beginners/foundational-beginner-yoga-poses/), [Yin practice references](https://www.yogajournal.com/practice/yoga-sequences-type/yin-yoga-sequences/), and [restorative practice](https://health.clevelandclinic.org/restorative-yoga). Arrangements, instructional descriptions and class intentions are original. All starters require coach review and publication before assignment. Props/variations retain their base Sanskrit name with explicit variation qualifiers, rather than invented Sanskrit names.

## Setup and verification

Run `npm ci`, `npm run build`, `npm test`, `npm run test:cloudflare`, `npm run test:e2e`, `npm run test:e2e:cloudflare`, and `npm run test:e2e:registration` using Node 24+. Migrations and seeds apply automatically on application startup. No additional secret, auth provider or Worker binding is needed. Production deployment uses the existing deployment workflow; this implementation does not deploy or alter the live database.

Coach review: verify suitability and transition pacing, edit drafts, optionally supply licensed image/video URLs, publish, then assign. Assignments preserve a snapshot, so existing classes must be assigned again when a coach wants trainees to receive revised content.

## Delivery validation — 2026-10-08

- Production TypeScript/Vite/Worker build: passed.
- Node unit/API/catalog/migration tests: **38 passed**.
- Cloudflare workerd shared API tests: **35 passed**.
- Existing local browser suite plus yoga sequencing/assignment/mobile checks: **10 passed**.
- Final Cloudflare browser suite, including yoga pose CRUD: **11 passed**.
- Private activation/invitation/registration/existing-workout browser workflow: **1 passed**.
- Exact seed totals verified: **126 poses, 12 complete draft flows, seven reusable blocks**. Every starter calculates exactly its listed 25–55-minute target. The sample calculates exactly 45 minutes.
- Screenshots reviewed at 1440px desktop and 390px mobile; automated overflow checks passed. Keyboard moves and HTML drag/drop events both tested for sections and steps. Completion survives reload.
- Existing client records, exercise prescriptions and instructions, exercise archives, workout logs, weekly assignments and custom edits preserved by upgrade/restart checks. SQLite foreign-key check passed.

Two existing browser tests initially timed out while multiple runtime/browser suites ran concurrently; both passed independently, and the final full Cloudflare browser run passed with suites run serially. Local test servers in this managed sandbox require the network capability; otherwise Node's runtime asserts while opening test sockets. Neither issue required changing application authentication or workout behavior.

Changes are committed on repository branch `feature/yoga-flow-builder`. No production deployment or live-database mutation was performed. Review and deploy using the repository's existing process, then review starter drafts and add licensed media as desired.

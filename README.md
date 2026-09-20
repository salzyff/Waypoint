# WAYPOINT
## Compile Before You Ship.

WAYPOINT moves border failure from the physical world into software, where it is cheaper to fix. This React application evaluates an actual shipment against structured preparation rules, surfaces blockers and uncertainty, and creates an immutable Shipment Passport. It is a hackathon MVP, not customs clearance software.

## Run immediately

Requires Node.js 20.19+ or 22.12+ and npm.

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Demo mode defaults to on and needs no account, API key, AI provider, or database. Use `npm run build` for production output in `dist`, and `npm test` for the compiler and PostgreSQL policy tests.

The application uses regular npm and Vite. Deploy `dist` to a static host with an SPA fallback to `index.html` for nested React Router routes. A Sites identity, when present, belongs to the original hosted project; do not reuse it for a different deployment.

## The product flow

Describe shipment → compile → detect blockers → fix evidence → recompile → generate a passport.

- Landing page, useful overview, searchable shipment table, five-step creation and editing.
- React Flow preparation graph, staged compilation, source panel, developer-style console.
- Explainable mandatory check counts, warnings, blockers, human-review states.
- Structured condition engine, latest published version selection, immutable snapshots and compilation differences.
- Temporary what-if scenarios and side-by-side market comparison using the same engine.
- Animated border simulator, PDF/print Shipment Passport, protected member-only links in connected mode.
- Saved products, document vault, explicit evidence acceptance, expiry warnings.
- Organisation profiles, membership, invitations, demo role exploration, notifications, command palette.
- Rule explorer, structured admin rule builder, draft/publish version lifecycle, source registry and audit log.
- Supabase Auth, PostgreSQL RLS, private Storage, transactional mutation RPC and server-side compile Edge Function.

## Demo data and accounts

All people, companies, trade rules, documents and classification suggestions in the demo are fictional or explicitly illustrative. No legal tariff estimates are fabricated. The organisation is **Kora Naturals Ltd**, with 12 shipments: 6 ready with a transport warning, 3 blocked, 2 drafts, and 1 requiring review.

There is no shared demo password. The hosted demonstration opens a session-only workspace. **Settings → Explore a demo role** enables exporter, consultant, organisation-admin and platform-admin views. The role switch is removed in connected mode. **Reset demo** restores all fictional session data. A full browser refresh also resets demo data. No private real documents should be entered in demo mode; uploaded metadata is temporary and file bytes are not stored.

## Hackathon presentation

1. Open the workspace, then the Shipment Compiler.
2. Select `PSG-NG-KE-9K2M`: Natural Shea Body Butter, Nigeria → Kenya, 500 cartons, 1,600 kg, USD 12,000.
3. Click **Recompile**. See **1 blocker / 1 warning** and **8 / 9 mandatory checks**.
4. Open **Simulate** and start the simulation. It stops at Destination requirements.
5. Select **Resolve with demo evidence**, then **Recompile & simulate**. All mandatory checks pass; the nonblocking transport warning remains.
6. Open the Shipment Passport and download the PDF.
7. Return to the compiler and open **What if?**. Ghana removes 3 Kenya-specific checks and adds 2 Ghana checks. The existing Ghana declaration satisfies that scenario. No original shipment changes.
8. Try doubling the value or changing manufacturing origin to trigger professional review.
9. Reset the demo from Settings before presenting again.

Suggested final line: **WAYPOINT moves border failure from the physical world into software—where it’s cheaper to fix.**

Demo evidence can be downloaded from Document vault. Each generated document prominently says DEMO / NOT FOR COMMERCIAL USE and contains no imitation government seals or approvals.

## Architecture

```
src/
  app/             Route composition, workspace state, auth boundary
  components/      Shared UI primitives, shell, React Flow graph
  features/        Compiler, shipments, passport, simulator, market comparison,
                   product/vault/organisation/settings and administration views
  services/        Pure rule evaluator, seed fixtures, Supabase adapter,
                   optional AI interfaces and PDF generation
  types/           Domain interfaces
supabase/
  migrations/      Tables, indexes, RLS, transaction RPCs, immutable audit triggers
  functions/       Authoritative server compile handler + shared engine
  seed.sql         Fictional rule/source fixtures, not real company data
scripts/           Engine synchronisation and seed generation
 tests/            Vitest engine tests and PGlite PostgreSQL integration tests
```

React 19, Vite, TypeScript, Tailwind CSS 4, Radix/shadcn-style shared UI primitives, React Router, TanStack Query provider, React Hook Form, Zod, React Flow, Framer Motion, Lucide, jsPDF and Supabase. There are no meaningless chart dependencies. Domain state mutations are explicit; the Query client is configured with conservative cache settings for future remote lookups.

The pure evaluator supports `equals`, `not_equals`, `in`, `gt`, `lt`, `exists`, `missing`, `date_before`, `date_after`, nested AND (`all`) and OR (`any`). It is independent of React and AI. Results embed the evaluated rule definitions and pack version IDs. Each compilation is a new record. Publishing a rule version does not rewrite previous results.

To synchronise the browser engine into the Edge Function after editing it:

```bash
node scripts/sync-engine.mjs
```

The demo engine runs locally. Connected compilation reads authenticated shipment and rule data on the server, calculates results there, then appends them through a service-role-only RPC. The endpoint accepts only shipment and organisation IDs, never user-supplied results or rules.

## Connect Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/202609190001_passage.sql` in the SQL editor, or apply it with the Supabase CLI migrations workflow.
3. For a noncommercial demonstration database, run `supabase/seed.sql`. This creates only the clearly labelled fictional rule packs and source reference. It does not create users or live shipment records.
4. Enable email/password Auth; configure the site URL and approved redirect URLs. Email verification and optional magic links use Supabase's configured delivery. Configure your own production email delivery if needed.
5. Copy `.env.example` to `.env` and use:

```dotenv
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

6. Deploy the compile function:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy compile
```

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to hosted functions. **Never put a service-role key in a `VITE_` variable.**

7. Rebuild/restart Vite after changing environment values.
8. Register an account, verify the email, sign in and create an organisation, or accept a pending invitation on the onboarding screen.
9. In Organisation, an admin can create pending invitations. The recipient signs in with a verified matching email and accepts invitations. The MVP does not send invitation emails.

To provision a platform administrator, use trusted database-owner SQL, after independently verifying the account UUID:

```sql
insert into public.platform_admins(user_id) values ('VERIFIED_AUTH_USER_UUID');
```

Platform administrator status is never granted through signup or the frontend. The user still needs an organisation membership for the workspace selector. Exporter, consultant and organisation-admin roles are scoped to each organisation.

### Database model

Core entities are normalised by organisation and stable ID. Shipment configuration, items, documents, rules and immutable compiler results use typed JSONB payloads to keep the MVP schema small and versionable. They are not a collection of unimplemented empty relational tables. SQL constraints enforce key identity, membership role values, compilation uniqueness and the shipment/org foreign key.

`save_workspace` applies only changed records in a transaction, checks membership and role, rejects stale values, refuses exporter self-approval of evidence and creates server-generated before/after audit entries. Published packs, compilation snapshots and audit logs are immutable. Sources can be updated; rule snapshots preserve the explanation and source ID that were evaluated, but do not embed a historical copy of the entire source registry.

The Storage bucket is private, accepts PDF/PNG/JPEG/TXT files up to 10 MB, and checks membership against the organisation prefix in every path. Signed document URLs last 60 seconds. Uploads enter `review` status; authorised evidence acceptance is separate from upload. No overwrite/delete policies are granted for evidence. The compile RPC limits the organisation to 30 runs per minute.

## Tests and verification

`npm test` includes pure evaluator tests and actual PostgreSQL execution through PGlite with mocked Supabase `auth`/`storage` schemas. Cases cover the exact demo, version selection, snapshot immutability, nested conditions, unsupported coverage, wrong-jurisdiction evidence, expiry, classification review, RLS isolation, stale edits, role escalation and immutable audit rows.

The schema and policies are tested locally. A real hosted Supabase project, live mail delivery and deployed Edge Function cannot be end-to-end verified until credentials/project configuration are supplied. The browser-based demo is independently usable without those services.

## Explicit MVP limits

- Nigeria, Ghana and Kenya only; five selectable demonstration categories. Rules are intentionally small and fictional, not a complete legal database. Production use requires vetted product-specific packs.
- Candidate codes are manually confirmed. No connected image recognition or AI extraction API. `AIProvider` exposes a replaceable interface and manual entry remains fully functional.
- Tariffs are **not configured**, never shown as zero. Transport changes are recorded but do not alter the current generic transport-document rule.
- Professional review notes and requests are recorded. A note does not silently override a hard blocker or uncertain origin calculation; underlying information/evidence must be corrected.
- Team invitation records are implemented, but invitation mail, existing-member removal/demotion and automated notification delivery are not included.
- No anonymous passport links. Connected sharing copies an organisation-member-only authenticated URL. Demo secure sharing is explicitly unavailable.
- Demo file metadata is session-only. Connected mode provides durable database and private file storage. No AI or network API is required for the demo.
- Single-product shipments in this MVP. No customs submission, carriers, payments, tariff database, ERP, or guaranteed clearance.
- No live Supabase project is provisioned or claimed by this delivery.

## Next pilot milestones

1. A trade professional validates a narrowly selected real corridor/category pack, with effective dates, source snapshots and update policy.
2. Deploy and audit a dedicated Supabase environment, strengthen file inspection with malware scanning, and verify organisation memberships and recovery flows end to end.
3. Extend reviewer decisions into explicit evidence-linked, versioned interpretation approvals and implement member administration.
4. Add provider-backed extraction and factual tariff lookup with confidence, citations and manual fallback.
5. Add live regulatory feeds and transaction APIs only after demonstrating reliable preparation outcomes.

## Safety and trust

WAYPOINT provides trade-preparation assistance. Official requirements should be verified with relevant authorities and licensed professionals before commercial shipment. WAYPOINT is not a customs authority, law firm, guarantee of clearance, or replacement for a licensed broker.

Official implementation references: [Supabase Auth getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

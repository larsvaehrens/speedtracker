# SpeedTracker

SpeedTracker is a mobile-first scorekeeper and statistics tracker for local
SpeedRunners games on one Nintendo Switch. It does not connect to the game or
detect results; a Match creator records each Round.

## Requirements

- Node.js 24 or a compatible newer LTS release.
- pnpm 10.33.0 (the project pins this version).
- A Cloudflare account with Workers and D1 for production deployment.

## Install and run locally

```sh
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install
cp .dev.vars.example .dev.vars
```

Dependency versions are defined in the `catalog` in `pnpm-workspace.yaml`.
Keep `package.json` dependencies and dev dependencies as `catalog:` references.

Replace `BETTER_AUTH_SECRET` in `.dev.vars` with a private random value of at
least 32 bytes. For example, generate one with `openssl rand -base64 32`. The
local variables are ignored by Git; never commit secrets.

Apply the local D1 migration, which creates the schema and seeds the 17 maps in
the requested order:

```sh
pnpm db:migrate:local
```

Start the app:

```sh
pnpm dev
```

Open <http://localhost:3000>, then sign up with a login username, screen name,
and password. To create another local development Player, run the app and seed
one through the same Better Auth signup endpoint used by the UI:

```sh
export SPEEDTRACKER_SEED_USERNAME=player_two
export SPEEDTRACKER_SEED_SCREEN_NAME="Player Two"
export SPEEDTRACKER_SEED_PASSWORD='use-a-private-local-password'
pnpm db:seed:user
```

The script accepts only a localhost URL. Set `SPEEDTRACKER_BASE_URL` if the
local app is on a different port. Do not use real or production credentials as
development seed values.

## Checks and tests

```sh
pnpm check       # formatting and lint
pnpm typecheck   # TypeScript
pnpm test        # domain and statistics tests
pnpm build       # production Worker and static asset build
```

`pnpm generate-routes` regenerates TanStack file-based routes after route
changes. `pnpm cf-typegen` regenerates Cloudflare binding types when the
Wrangler configuration changes. Keep generated route/binding files out of
manual edits.

## Gameplay and data model

- A Player is an account. A Competitor is a solo Player or a two-Player team.
- Setup supports 1 vs. 1, 1 vs. 1 vs. 1, 1 vs. 1 vs. 1 vs. 1, 2 vs. 2, 1 vs.
  2, and 1 vs. 1 vs. 2. A Player cannot be in more than one Competitor.
- Player profile pictures appear in the Setup picker, open Matches, Match
  history, and opponent/teammate statistics.
- A solo Competitor needs three points to win a Match. A team needs four.
- A winning solo Round adds one point. For a team Round, the sole survivor gets
  one individual point and the team one point; if both survive, each gets one
  individual point and the team gets two points.
- Scoring buttons show the next numbered emblem based on the Competitor's
  current score. A team double win shows two consecutive emblems; at three
  points, it shows emblem-4 twice.
- Round winners, survival/individual point attribution, undo history, and
  revision/idempotency data are persisted. Scores and outcomes are derived from
  the Round records. Match statistics count completed Matches, not Rounds.
- A Match may start without a map. The map is required to finalize a threshold
  victory. A pending winning Round remains recorded while the scorekeeper
  selects one.
- The creator is the scorekeeper. Match participants can view live and
  completed state; unrelated users cannot access private Matches. Following
  someone makes them selectable in Setup, but does not expose their private
  Matches.
- Open Matches poll the server every two seconds; connected participants
  normally see updates within about two to three seconds. The server is
  authoritative. Pending saves and connection errors remain visible, retries
  reuse an idempotency key, and clients refresh authoritative state after
  reconnecting. Offline-first play is not supported.
- Initial session/Match loading and statistics use layout-matched skeletons.
  Background refreshes keep existing content visible, and skeleton animation
  is disabled when reduced motion is requested.
- Match duration is elapsed wall-clock time from Match start to completion.
  Abandoned Matches are retained for reference but excluded from completed
  history and statistics.
- The statistics page shows match win rates, map and opponent performance,
  teammate partnerships and point contribution, streaks, and total time in
  completed Matches (displayed in minutes, hours, or days). Each rate shows
  its sample size; maps with no completed matches are omitted. Map pictures
  appear alongside map names in statistics and Match history.
- Current and longest daily play streaks count distinct local calendar days
  with completed Matches. The current streak remains active if the last
  played day was yesterday, and resets after a missed day.

The map label is **Casino**. Its existing image filename is
`public/ressources/maps/12_Casion.png`; the asset is intentionally not renamed.
Avatars and map images remain under the existing `ressources` spelling.

## Authentication and account recovery

Authentication uses Better Auth's username/password support and password
handling. Signup asks for no email and no email service is configured. To
support the Better Auth username plugin, the server derives a private
`@accounts.speedtracker.invalid` alias internally; it is not user-supplied or
deliverable. There is no password reset or account recovery. A Player who
forgets their password cannot recover access to that account; make sure
participants understand this before they create accounts.

Sign-in and signup are rate-limited with the Cloudflare `AUTH_RATE_LIMITER`
binding. Passwords must be 10–128 characters. Session checks, match visibility,
and scorekeeper authorization are enforced server-side.

## Cloudflare D1 and production migrations

The D1 binding and migration directory are configured in `wrangler.jsonc`.
For production:

1. Create the D1 database in the intended Cloudflare account:

   ```sh
   pnpm exec wrangler d1 create speedtracker-db
   ```

2. Put the resulting database ID in `wrangler.jsonc`. Set the canonical
   `BETTER_AUTH_URL` to the final HTTPS URL (for example,
   `https://speedtracker.example.com`).
3. Set the Worker secret once:

   ```sh
   pnpm exec wrangler secret put BETTER_AUTH_SECRET
   ```

   Enter a unique, private random value of at least 32 bytes. Never put this
   value in `wrangler.jsonc`, `.dev.vars.example`, or GitHub source.

4. Review pending SQL migrations and make a database backup before any
   destructive schema change. Do not edit a migration that has already been
   applied; add a new numbered migration instead.
5. To apply a reviewed migration manually:

   ```sh
   pnpm db:migrate:remote
   ```

The GitHub deployment workflow runs formatting/lint, type-checks, tests, and a
production build before applying pending D1 migrations and deploying the
Worker. D1 migrations are applied with Wrangler's remote migration command;
additive migrations are preferred so the currently deployed Worker remains
compatible while rollout is in progress.

## GitHub deployment and custom domain

The workflow in `.github/workflows/deploy.yml` deploys when code is pushed to
`main` or when manually dispatched. Configure these repository Actions secrets:

- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token scoped to the target account
  with Workers Scripts edit and D1 edit permissions.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID for that token.

After setting those secrets, merge or push a checked change to `main`. Keep the
`database_id` and `BETTER_AUTH_URL` in `wrangler.jsonc` matched to the
production environment before deploying. Add the custom subdomain to the
deployed Worker under **Workers & Pages → speedtracker → Settings → Domains &
Routes → Add Custom Domain**. Cloudflare will configure the DNS route. Then
set `BETTER_AUTH_URL` in `wrangler.jsonc` to that exact HTTPS origin and deploy
again so session cookies and trusted origins use the canonical domain.

## Project structure

- `src/domain/`: pure setup, scoring, permissions, and statistics rules.
- `src/server/` and `src/routes/api/`: Better Auth, D1 access, authorization,
  and integrated server endpoints.
- `src/components/`: responsive match, setup, map, history, statistics,
  friends, and profile views.
- `migrations/`: versioned D1 schema and map seed data.
- `public/ressources/`: static map and hero artwork.

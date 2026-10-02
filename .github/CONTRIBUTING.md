# Contributing to SpeedTracker

Thanks for helping improve SpeedTracker. Contributions should preserve the
project's mobile-first scorekeeping experience and keep match data safe.

## Set up the project

Use Node.js 24 and pnpm 10.33.0. From the repository root:

```sh
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install
cp .dev.vars.example .dev.vars
```

Set a private `BETTER_AUTH_SECRET` of at least 32 bytes in `.dev.vars`, then
apply the local database migrations and start the app:

```sh
pnpm db:migrate:local
pnpm dev
```

Never commit `.dev.vars`, credentials, real player passwords, or production
data. See the README for more local development and Cloudflare setup details.

## Make and verify a change

Keep changes focused and follow existing TypeScript, React, domain, and database
patterns. Add or update tests for behavior changes. Before opening a pull
request, run:

```sh
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

Add a new numbered SQL migration for schema changes; do not edit migrations
that may already have been applied. Prefer additive changes that remain
compatible during deployment.

## Commits, Changesets, and pull requests

Use [Conventional Commits](https://www.conventionalcommits.org/) for every
commit. CI checks commit messages. Examples:

```text
feat: show round scoring times
fix: prevent rapid repeat scoring
docs: explain local setup
```

For a user-visible application change, add a Changeset so the release workflow
can produce the version and changelog entry:

```sh
pnpm changeset
```

Choose the appropriate bump and describe the user-facing change. Documentation
or internal-only changes that do not affect the application do not need a
Changeset. The release workflow creates a version pull request and GitHub
Releases; the app is not published to npm.

Open a focused pull request with a clear summary and testing notes. If working
in a GitHub PR stack, keep each task in its own branch and target the preceding
branch in the stack. Do not push or submit a stack unless you are authorized to
do so.

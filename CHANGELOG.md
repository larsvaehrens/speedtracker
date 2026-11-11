# speedtracker

## 0.3.2

### Patch Changes

- 64f95eb: chore(deps): update better-auth monorepo to v1.7.18
- 52bb487: chore(deps): update dependency @cloudflare/vite-plugin to v1.68.0
- f749442: chore(deps): update dependency @vitejs/plugin-react to v6.2.1
- 5eca21d: chore(deps): update dependency wrangler to v4.158.0
- 364a3a4: chore(deps): update pnpm to v12.18.0
- b9e4f2f: chore(deps): update vite-plus monorepo to v1.5.0
- 146a3b8: chore(deps): update better-auth monorepo to v1.7.19
- c8a2e27: chore(deps): update tanstack-router monorepo

## 0.3.1

### Patch Changes

- a4bd4d5: Correct Renovate's minimum release age behavior setting.
- db2ee56: Add a security policy and a web security.txt file with private vulnerability reporting instructions.
- 952141a: Use the Renovate pull request title as the generated changeset message.
- 3deba52: Update the release workflow to use the current Changesets action input names.
- ab99175: chore(deps): update dependency @better-auth/drizzle-adapter to v1.7.7
- fcebf28: chore(deps): update dependency better-auth to v1.7.7
- addcb1c: chore(deps): update better-auth monorepo to v1.7.15
- 5b448fc: chore(deps): update commitlint monorepo to v21.2.4
- fde3b7a: chore(deps): update dependency @types/node to v22.20.5
- 68bf2e9: chore(deps): update dependency @vitejs/plugin-react to v6.1.2
- 3152233: chore(deps): update dependency drizzle-orm to v0.45.4
- 1b57214: chore(deps): update react monorepo to v19.3.1
- e0025e6: chore(deps): update tanstack-router monorepo
- ea5b906: chore(deps): update dependency @cloudflare/vite-plugin to v1.66.0
- 654e47e: chore(deps): update pnpm to v10.34.9
- a8eff00: chore(deps): update actions/checkout action to v7
- c0292e6: chore(deps): update actions/setup-node action to v7
- 6b208eb: chore(deps): update dependency wrangler to v4.156.0
- 8e30b78: chore(deps): update changesets/action action to v2
- 0720bb4: chore(deps): update dependency node to v26
- f108113: chore(deps): update pnpm to v12
- d433ff2: chore(deps): update pnpm/action-setup action to v6
- 957bcff: Configure Renovate to propose dependency updates weekly.
- 1aaccda: Add reference to contributions guidelines in README.
- c9f5201: Automatically add changesets to Renovate dependency update pull requests.
- 56af8e0: Add minimum release age to Renovate config.

## 0.3.0

### Minor Changes

- 4bd4bd5: Recommend players on the Players page based on friends of friends, with a one-click Add button and a mutual friend count.
- da0eeea: Make opponent and teammate names clickable to open their statistics profiles.
- 42c5457: Make friendships mutual: adding a friend adds you to theirs, and players who play a match together become friends. A migration backfills existing friendships and past matches.
- b3420ad: Add a friend toggle to another player's statistics profile.

### Patch Changes

- 76871f5: Count multiplayer opponent results against the winner, without attributing results between other losing competitors.
- 8b9d521: Refetch the friend list after adding or removing a friend.
- 5ebd151: Add a Today preset to the match date filter for filtering today's matches and statistics.
- fcc1f5e: Fix match history layout on small screens so the round timeline can use the full card width.

## 0.2.0

### Minor Changes

- 0750b29: Add support for installing SpeedTracker as a standalone home-screen app with matching app icons.

### Patch Changes

- 74200ad: Update Vite+ and align its Vite core and test tooling.
- b3d470e: Show the full year of match activity on desktop and the last three months on mobile.
- 4816f25: Improve timeline layout by removing players that didn't score, R1, R2, R3 numbering. Also made the timeline vertical on small viewports.
- cd07408: Improve modal layout and responsiveness on mobile.
- 95fbd2b: Improve image quality of maps
- 1286fce: Update emblem graphics
- 8edf646: Update TanStack Start and align its React Router dependency.
- 7ecd7b4: Rename "Warehouse" map to "Silo".
- 080bf06: Fix a padding issue in the friends list when a user has no friends.
- 3500ca4: Keep match controls within the mobile viewport.

## 0.1.1

### Patch Changes

- 411baad: Show points as elapsed time on evenly spaced timelines in history and live matches.
- 6f30491: Keep supported mobile screens awake during active matches.
- ae6e773: Add a daily match activity graph to player statistics.
- d3cd40d: Collapse game-mode selection by default.
- 017730f: Use point terminology consistently throughout the app.
- f9c36c9: Allow scorekeepers to repeat a completed match setup without a map.
- 10c9a31: Allow the scorekeeper to pause and resume active matches.
- 5a433de: Prevent a second point from being scored within five seconds.

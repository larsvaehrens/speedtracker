# speedtracker

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

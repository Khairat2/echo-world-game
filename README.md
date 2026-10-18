# ECHO — The World Between Light and Darkness

A static Canvas puzzle-platformer. No dependencies, backend, install, or build step.

## Play locally

Open `index.html` directly in a modern browser, or serve this folder:

```powershell
python -m http.server 8000
```

Visit http://localhost:8000. Use a local server for consistent browser storage behavior.

- Move: A / D or left / right arrows
- Jump: Space, W, or up arrow (hold for a higher jump)
- Change world: E or Shift, or the world button
- Pause / resume: Escape or the pause button
- Return to checkpoint: R
- Touch devices show left, right, jump, and world-switch buttons.
- The sound button mutes synthesized effects. Audio begins after interaction.

Light platforms glow gold; dark platforms glow cyan. Neutral stone exists in both worlds. Collect up to 18 memory shards and reach each portal. Chapter 1 teaches walking, one hop, and stationary world switching on solid ground. Its falls cost no sparks and return you immediately to the practice gap. Chapters 2 and 3 use five sparks, checkpoints, active pink crystal spikes, world-specific platforms, and magic seals. Shards are optional collectibles. Completion time excludes menus and pauses. Shared rankings prioritize chapters completed, then elapsed seconds.

## New difficulty progression

### Chapter 1: very easy tutorial

This replaces the old alternating platform course entirely. Every tutorial floor is neutral, at y=560. The player can stop, wait, change worlds, and walk safely on every landing area. There are no spikes.

| Floor | X range | Width | Purpose |
| --- | --- | ---: | --- |
| Opening promenade | 0-760 | 760 | Walk only; first two memories |
| Practice landing | 792-1412 | 620 | One 32px hop, third memory, checkpoint at x=1120 |
| Cyan seal floor | 1412-1872 | 460 | Stop at x=1500; E / Shift opens the Dark seal; fourth memory |
| Golden seal floor | 1872-2372 | 500 | Stop at x=2110; E / Shift returns to Light; fifth memory |
| Homeward floor | 2372-2720 | 348 | Walk into the portal at x=2600 |

The only gap is 32 logical pixels, slightly wider than the 26px character. Everything after that gap forms one continuous, level path. Switching is taught separately from jumping, with context-sensitive instructions. Missed jumps recover just before the gap with all memories and sparks retained. No tutorial game over is possible. Existing 140ms coyote time and 180ms jump buffering remain.

Screenshots captured in Chrome at 100% zoom: `tests/tutorial-walking.png`, `tests/tutorial-landing.png`, `tests/tutorial-dark-seal.png`, and `tests/tutorial-light-seal.png`.

### Chapter 2: medium

55-70px gaps, mostly 170-240px landing areas, and 15-45px upward steps. Start with neutral footholds, solve a seal on a safe platform, then learn to jump onto same-world footholds before the first Light-to-Dark airborne switch. Two spike clusters add simple obstacle jumps. The checkpoint is at x=1375.

### Chapter 3: hard

85-110px gaps, 135-150px world-specific landings, 65-75px climbs, frequent airborne world changes, two world seals, and three active spike clusters. Neutral rest areas at x=1080 and x=2130 separate the demanding sequences. The checkpoint is at x=1140. This chapter is longer and requires held jumps and deliberate world planning.

## Validation

With the game server running at localhost:8000:

```powershell
node --check script.js
node tests/gameplay.cjs
node tests/jump-chrome.cjs
node tests/jump-chrome.cjs --chapter1 --screenshots
node tests/jump-chrome.cjs --chapter1 --campaign
```

The simulation verifies walking-only progression, free recovery, nine beginner hop variations from a standstill, both grounded switch seals, all later-chapter platform transitions, real hazard collisions, pause / game-over / victory behavior, jump buffering, coyote time, and the leaderboard schema.

The Chrome runner uses installed Chrome and Node 22+ with no additional packages. It sends trusted keyboard and mouse input through Chrome's browser protocol. It loads the actual game from **http://localhost:8000/?v=tutorial-2**, disables test-browser caching, checks the game version, and compares the served HTML, JavaScript, and CSS byte-for-byte with the project files before testing. Set `CHROME_PATH` if Chrome is installed elsewhere.

`--chapter1` walks the opening stretch without jump input, deliberately misses the gap to check free recovery, crosses it with an 80ms Space tap, opens both seals while grounded, and collects all five memories before exiting. It never teleports or manually advances game physics. `--screenshots` captures the tutorial at 1920x1080 and 100% zoom. `--campaign` continues through the medium and hard chapters with keyboard input.

The no-argument Chrome test checks Space, W, ArrowUp, button focus, pause/resume, menu activation, world switching, and scroll prevention. Open `tests/browser.html` for the older quick synthetic-event smoke check; the trusted-input Chrome tests are the primary control checks. Touch devices should also be manually checked for simultaneous movement / jump input.

The spike world filter now reads the fifth array field, rather than confusing spike height with its world identifier; spikes are active in Chapters 2 and 3. Chapter 1 intentionally has none.

## Publication preparation

The game is ready as five static files: `index.html`, `style.css`, `script.js`, `startng.json`, and `cover.png`. There is no install or build step. Local assets use relative paths; the only runtime external service is HTTPS start.ng.

The root `.gitignore` uses an explicit allowlist for those five files, `.gitignore`, and this README. All local tests, screenshots, browser profiles, browser logs, backup folders, downloaded documentation, cover tooling, and unreviewed files are excluded from a normal `git add`. No existing local files were deleted. Add a reviewed exception to `.gitignore` if you introduce new game assets later.

The publication audit validates required files, relative paths, manifest fields, PNG integrity / dimensions / size, the exact prospective Git file list, and common secret patterns. Run the local-only checks with:

```powershell
python tests/publication-audit.py
node tests/startng-integration.cjs
```

The start.ng contract tests use synthetic replies and do not sign in or write real scores. They verify strict origin / source / type / request ID checks, connection retry after an initial failure, identity refresh, guest behavior, sign-in links, exact integer score stats, leaderboard rows, and documented character appearance options. Real start.ng sign-in and score saving still need verification after the game is hosted on a start.ng subdomain.

The release uses the `main` Git branch. Publication to start.ng is a separate step and has not been performed. The server-side `/games/check` step requires a public repository and has not been run. Local tests and their screenshots are intentionally kept out of the public repository.

## start.ng

Implemented against https://start.ng/docs.md (local snapshot in `startng-docs.md`, excluded from publication). The hidden connect iframe uses exact origin, source window, reply type, and request ID validation. Identity refreshes on focus and visibility changes. Characters render body, clothing and skin colors, all documented hair / hat / accessory choices, with safe defaults. Guest play never depends on the connection. Sign-in is an explicit link.

`startng.json` declares `levels_completed` (highest) and `completion_time` (lowest, seconds). Completed chapters submit integer stats for signed-in players. The leaderboard requests ten entries and marks your own entry. `cover.png` is generated artwork, 1600 × 1000, below 2 MB.

Identity, sign-in return, score saving, and shared rankings require hosting on a `*.start.ng` domain and cannot be fully tested locally. To publish, use a public GitHub repository, then start.ng's documented `/games/check` and `/games/publish` API workflow. No repository was supplied and this project has not been published.

## Files

`index.html`, `style.css`, `script.js`, `startng.json`, and `cover.png` are the deployable game. `tests/` contains local checks. The original empty folders named `index.html`, `style.css`, and `script.js` were preserved as `*.original-folder`.

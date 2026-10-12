# Prompts for overdrive-batch

Fill the `<...>`. Every prompt starts with the cwd and the "Do not" block.

## Common blocks

**Do not** (paste in every prompt):

```
Do not: publish a release, merge, comment on PRs/issues/Discord, force-push or amend,
touch other worktrees, edit ~/Documents/ps5-react directly.
If you need a decision from the owner, STOP and end with the question, the options and your recommendation.
```

**Trailers** (fix and integration prompts):

```
Commits end with: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
PR bodies end with: 🤖 Generated with [Claude Code](https://claude.com/claude-code)
Label the PR batch:<version>.
```

## D: diagnosis (read-only)

```
cwd: <absolute path>. Read-only: do not edit, commit or push.
<Do not block>

Report from <tester>: <text, screenshot description, app.log excerpt or path>.

Deliver:
1. The cause, with file:line in game-store and/or ps5-react.
2. Whether it is already fixed: check git log on main, open PRs and the releases on overdriveps5/overdrive-releases.
3. Your arithmetic and assumptions spelled out (units, timestamps, versions).
4. What to ask the tester to confirm, if anything.
5. The fix you would make, in two lines.
```

## F: fix

```
cwd: <absolute worktree path>, branch fix/<slug> off main.
<Do not block>

Task: <what is wrong, with the diagnosis's file:line>.
<Contract block, if engine and app change together>

Deliver: an open PR against main, the file:line you changed, the tests you added or ran
(native/**/*.test.mjs; engine: npm test), and what only a console can confirm.
<Trailers block>
```

## C: contract (engine + app in parallel)

Paste the same text into both prompts, unchanged:

```
Contract (do not change it; if it cannot hold, STOP and say why):
- Signature: <function/export, arguments, return>
- Semantics: <what it does, when, ordering, side effects>
- Errors: <what throws or returns, exact codes>
- Messages: <exact strings shown or logged>
The engine PR is <link or "being written">. The app PR states "Depends on overdriveps5/ps5-react#<n>".
```

## R: review (read-only, Opus 5.5)

```
cwd: <absolute worktree path of the PR or the integration branch>. Read-only.
<Do not block>

Review <PR links> in <repo>. Look for bugs that break production on a console: crashes,
lost or corrupted saved data, updater or download failures, freezes. Skip style.
For each finding: BLOCKS / should / nit, file:line, the scenario that triggers it, and confirm it
in the code before reporting it. End with a one-line verdict.
```

## I: batch integration

```
cwd: <absolute path>. Create integration worktrees in both repos, branch integration/<version>:
- git -C ~/Documents/personal/game-store worktree add $WORKTREES/integration -b integration/<version> origin/main
- git -C ~/Documents/ps5-react worktree add $WORKTREES/ps5-react-integration -b integration/<version> origin/main
  and symlink .deps and node_modules from ~/Documents/ps5-react.
Do not publish, do not push to main, do not merge PRs on GitHub. <Do not block>

1. Merge every PR of the batch: engine <list> first, then app <list>. Note each conflict.
2. Copy .claude/skills/overdrive-deploy/config.local from ~/Documents/personal/game-store (gitignored),
   set its PS5_REACT_DIR to the engine integration worktree and its OVERDRIVE_CATALOG_DIR to the
   private catalog checkout (~/Documents/personal/overdrive-catalog), and run release.sh steps 1–4
   by hand, no publish: catalog (OVERDRIVE_CATALOG_DIR=… node native/scripts/prepare.mjs), every native/**/*.test.mjs,
   engine npm test, native/scripts/smoke-launch.mjs (damaged and upgrade fixtures), PS5 build,
   tools/verify.py, ZIP with mode 777 on every entry, exFAT image from the same build.
3. QA the screens the batch touched in the desktop preview with the ps5-drive skill: <screens>.
4. Check native/state/fixtures/upgrade/ has the version in releases/latest of
   overdriveps5/overdrive-releases. If not, say so: the batch adds it.

Deliver: a guard → result table, each conflict and the PR where it must be fixed,
flaky tests, and production risks.
```

## T: tester checklist (Sonnet 5.5, meu-tom)

```
Draft with the meu-tom skill, English, lowercase, under 2000 characters, one message per tester.
Beta <tag>: <release link>. For <tester>: the fix for what they reported, how to check it,
what to send back (screenshot, /data/ps5-react/PPSA99058/app.log). Also ask: does the app open and
update from the previous version? Do not post it: return the text.
```

---
name: overdrive-batch
description: Orchestrate a batch of Overdrive fixes through Paseo agents, from tester reports to a released version. Use whenever bug or tester reports arrive (Discord screenshots, app.log), when asked to fix several things in parallel, close a batch, gather or merge PRs, or prepare the next version ("chegou relato", "corrige isso tudo", "fecha o lote", "junta os PRs", "prepara a próxima versão").
---

# Run a batch of Overdrive fixes

You are the orchestrator. You never edit code: you create workspaces and agents in Paseo, read their reports and keep the owner informed. Prompts to copy are in [prompts.md](prompts.md).

## Rules

- Delegate only through Paseo: `mcp__paseo__create_workspace`, `create_agent`, `send_agent_prompt`, `respond_to_permission`. Never the built-in Agent tool.
- Models: Opus 5.5 (`claude-opus-5-5`) for investigation, code and review; Sonnet 5.5 (`claude-sonnet-5-5`) for light tasks such as drafting a message. Never a 4.x model.
- Keep `notifyOnFinish` on and wait for the notification. No polling.
- One agent per worktree, never two. `$WORKTREES` below is the folder Paseo keeps this project's worktrees in (`~/.paseo/worktrees/<project id>`).
- Answer the owner in pt-BR, short. Keep the batch table (below) in every answer.
- The owner does not test on a console. Only testers do.

## 1. Intake

Each report gets a read-only diagnosis agent (prompt D): cause with file:line, whether it is already fixed (git log, PRs, releases), what to ask the tester.

Before telling the owner, rate your confidence 0–10 and check the agent's arithmetic and hypotheses yourself (GB vs GiB, timestamps, versions in the log). Draft the tester reply with the `meu-tom` skill (English, under 2000 characters, lowercase) and review it. Never post it.

## 2. Fix

One task, one worktree, one agent:

- App: `create_workspace` with isolation `worktree`, off `main`, branch `fix/<slug>`; then `create_agent` with prompt F and that `workspaceId`.
- Engine: `git -C ~/Documents/ps5-react worktree add $WORKTREES/ps5-react-<slug> -b fix/<slug> origin/main`, symlink `.deps` and `node_modules` from `~/Documents/ps5-react`, then `create_workspace` on that path.

A change in both repos runs in parallel against a fixed **contract** (signature, semantics, errors, exact messages) written into both prompts (prompt C). The app PR states it depends on the engine PR. Stacked branches sync by merge, never rebase or force-push.

When an agent stops with a question for the owner, relay it with the options and your recommendation.

## 3. Review gate

Per repo, a read-only review agent on Opus 5.5 (prompt R): bugs that break production, each finding marked BLOCKS / should / nit and verified in the code. Fixes go back to the PR's own agent with `send_agent_prompt`, as new commits.

## 4. Batch integration (the main gate)

One agent (prompt I) creates `integration/<version>` worktrees in both repos, merges every PR of the batch (engine first) and runs steps 1–4 of `release.sh` without publishing: catalog, `native/**/*.test.mjs`, engine `npm test`, smoke launch over damaged and upgrade fixtures, PS5 build + `tools/verify.py` + ZIP 777 + exFAT. It QAs the touched screens in the desktop preview (`ps5-drive`) and checks that an upgrade fixture exists for the version in `releases/latest`; if not, the batch adds one.

It reports a guard → result table, conflicts and production risks. Conflicts are fixed in the PRs, not only locally. A flaky test becomes its own card.

## 5. Version

Engine change or a big batch → minor bump (0.1.4 → 0.2.0). Only small fixes → patch.

## 6. Merge and release (only on the owner's explicit OK)

1. Merge engine PRs, then app PRs. Run the tests on `main` and check its tree matches the integration branch.
2. Always `--prerelease` (beta) first.
3. Big batch or minor: send a per-fix checklist to the tester who reported each bug (prompt T). Wait for every critical fix and for the app opening and updating to be confirmed.
4. Then `--candidate` (rc), then `--promote`. Never `--force-latest` with a new engine.
5. A bug found in the beta is a PR through this same flow and a new beta.

## Tracking

Label every PR in both repos `batch:<version>` (`gh label create` once per repo). Keep this table in each answer:

| task | agent | worktree | PR | status |
|------|-------|----------|----|--------|

## Lessons

Append what each batch taught, one line each.

- Guards run again after the review's fixes, not only before.
- Rebasing a stacked branch replays its commits: merge instead.
- An agent may need permission to write fixtures under `/tmp`; answer it with `respond_to_permission`.

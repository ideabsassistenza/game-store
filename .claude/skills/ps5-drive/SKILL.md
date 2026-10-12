---
name: ps5-drive
description: Drive and inspect the Overdrive desktop preview like a browser automation tool — press controller buttons, read the focusable elements as JSON, jump focus by key, take screenshots, read logs. Use to QA or debug the Overdrive UI, to see the screen, check a layout, reproduce a UI bug, or verify a change before handing it over ("ve na UI", "tira print", "debuga a interface", "QA visual").
---

# Drive the Overdrive preview

Screenshots of this preview are allowed for this project: use them to verify UI work before handing it over.

```sh
D="python3 $HOME/Documents/ps5-react/tools/ps5_drive.py"
$D start --app-dir ~/Documents/personal/game-store/native   # builds, launches, waits until it answers
$D wait 6000                      # let the first screen load
$D press down                     # up/down/left/right/confirm/back/triangle/square/l1/r1/l2/r2
$D focus catalog:filters          # jump to an element by focusKey ("not found: …" otherwise)
$D snapshot                       # on-screen focusables, one line each: @e3 > "text" key=… [x,y wxh] (logical px, > = focused)
$D diff                           # since the last snapshot/diff: focus change, + added, - removed, ~ text changed, N moved
$D focus @e3                      # refs from the last snapshot work wherever a focusKey does
$D snapshot --all | --json        # include off-screen / hidden layers; raw records
$D shot /tmp/ui.bmp               # 960×540 frame; read it with the Read tool
$D logs                           # output since the last call: JS errors, slow frames, timer warnings
$D stop
```

- One preview at a time on `/tmp/ps5-drive.sock` (`PS5_DRIVE_SOCKET` overrides). Its full output is in `/tmp/ps5-drive.sock.log`.
- `press` queues the action like a real button; follow it with `wait 300`+ before `snapshot` or `shot` so the frame catches up.
- `snapshot` text comes from each element's `Text` children, cut at 60 characters; it lists only what is on screen and reachable (about 400 tokens for a full screen). After a `press`, read `diff`, not a new snapshot: it is usually one line.
- Find a screen's keys with `snapshot` first, then `focus` straight to it instead of pressing through.
- Keyboard in the window, for the user: arrows, Enter/Space = ✕, Backspace = ◯, T = △, F = ▢, Q/E = L1/R1, Z/C = L2/R2, Esc quits.
- After editing app code, `stop` and `start` again: the preview does not reload.

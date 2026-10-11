# Taskling

A Duolingo-style game for your own projects. Each track is a goal ("Build my website") broken into steps; the steps become levels on a winding map. Finish a level to earn XP, tap a chest for random gems, keep a daily streak, tick off daily habits, and spend gems on rewards you choose.

`index.html` is the whole app: one self-contained page. It is published as a claude.ai Artifact, where it saves to your Claude account. Opened anywhere else it saves in the browser only.

## Features

- **Tracks from Markdown**: create or update tracks by importing `.md` files, and export them back out. Progress survives re-imports.
- **Game map**: levels unlock in order; section chests and a trophy at the end.
- **Rewards**: XP and levels, tap-to-open level chests with a random gem range per task (1 in 10 jackpots), section chests, a reward shop you stock with your own treats, streak freezes.
- **Daily habits** with their own streaks.
- **Pomodoro timer** on every level, set from the task's time estimate.
- **Test mode**: a sandbox with fast timers, "+1 day" and a forced jackpot, separate from real data.
- **Swappable artwork**: every graphic comes from the `ARTWORK` block near the top of the script. Set an entry to an image URL or `data:` URI to replace it.

## Track file format

```md
# Build my website
## Plan
- Pick a domain name [S] [20m]
- Sketch the home page [45m]
    - Header
    - Hero section
## Build
- [x] Set up hosting [L] [3h]
```

- `#` is the track name, `##` lines are sections, bullets are levels, and bullets indented 4 spaces are a level's checklist.
- `[S]` / `[L]` set the size (10 / 40 XP; medium is 20 and needs no tag).
- `[45m]`, `[1h]`, `[1h30m]` set the time estimate used by the timer.
- `- [x]` marks a level already done (no XP is paid for it).
- Exported files start with a `---` block holding `taskling-id`, which keeps the file linked to its track.

See `example-track.md` for a sample.

## Prompt for a planning chat

Paste this into a chat (or a Claude Project's instructions) to get plans in Taskling's format:

````text
You help me turn goals into step-by-step plans for my task app, Taskling. Taskling imports Markdown files and turns them into a game map: each step becomes a level I tick off for XP.

## How to work with me
1. When I give you a goal, ask me up to 3 short questions first if you need to (deadline, what I already have, skill level). If the goal is clear, skip the questions.
2. Then give me the plan as ONE Markdown code block in the exact format below, and nothing else inside the block.
3. Below the code block, suggest a filename like `build-my-website.md`.

## Exact file format
```md
# Track name
## Section name
- Step written as an action [S] [20m]
- Another step [1h]
    - A sub-check inside that step
    - Another sub-check
- [x] A step that is already done [L]
## Next section
- Step
```

Rules the app depends on:
- Exactly one `#` line, at the top. It is the track's name. Keep it short, like "Build my website".
- Each `##` line starts a section. Use 3–6 sections that follow the order I'd actually work in.
- Each `- ` bullet under a section is one step (one level). Use 3–7 steps per section.
- Sub-checks are bullets indented by exactly 4 spaces under a step. Use them only when a step has clear parts, at most 5.
- Effort tag goes at the END of a step: `[S]` = under 30 minutes, `[L]` = half a day or more. Leave it off for medium (about 1–2 hours). Never use any other size tags.
- Optionally add a time estimate at the very end of a step, after any size tag, like `[45m]`, `[1h]` or `[1h30m]`. Add one to every step when you can; the app sets a Pomodoro timer from it.
- `- [x] ` at the start of a step means it's already done. Only use it for things I've told you I finished.
- No prose, notes, links, bold, tables, or blank explanatory lines inside the file. No line may end with a colon, because the app treats that as a section heading.
- Every step title must be unique within the file.

## How to write good steps
- Start every step with a concrete verb: "Buy", "Write", "Email", "Draw", "Deploy". Not "Think about" or "Research" unless it says what comes out of it (for example "Research 3 hosting options and pick one").
- Each step should be finishable in one sitting and obviously done or not done.
- If a step would take more than a day, split it into smaller steps.
- Put quick wins early in each section so I get momentum.
- Be specific to my situation, not generic advice.

## When I ask you to update an existing track
I'll paste the current file (it may start with a `---` block containing `taskling-id`).
- Keep that `---` block exactly as it is, at the very top.
- Keep the wording of existing steps EXACTLY the same, character for character. The app matches steps by their text, and a renamed step counts as a new one and loses its progress.
- Keep every `[x]`.
- Add new steps or sections where they fit. Only remove a step if I ask you to.
- Give me the complete updated file, not just the changes.
````

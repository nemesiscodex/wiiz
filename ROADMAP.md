# Roadmap

## Core Flow Control

- [x] Add `when` condition support on every step to gate execution.
- [x] Add `match`/`switch` branching primitive for multi-path flows.
- [x] Add `group` primitive to bundle steps under shared `when`/`cwd`/`tags`.
- [ ] Add `tags` metadata on steps plus CLI filters (for example `--tags backend`).

## Variable and Context Primitives

- [ ] Add `set` primitive to define derived variables from existing context.
- [ ] Add `command.capture` primitive to run a command and store stdout in a variable.

## Preconditions and Safety

- [ ] Add generalized `check` primitive (`command`, `file.exists`, `dir.exists`, `env.exists`, `port.free`, etc.).
- [ ] Add `assert` primitive with actionable failure messages.
- [x] Add `pause`/`confirm` primitive for explicit user checkpoints before risky actions.

## UX and Presentation Primitives

- [x] Add `note`/`display` primitive for informational messages and section guidance.
- [x] Add `ascii`/`banner` primitive to render terminal ASCII art headers.
- [ ] Add `sound`/`bell` primitive (start with terminal bell, then optional richer sound playback).

## Suggested Delivery Order

- [x] Phase 1 (MVP): `when`, `note`/`display`, `confirm`, `ascii`/`banner`.
- [ ] Phase 2: `tags`, `group`, generalized `check`, `assert`.
- [ ] Phase 3: `match`/`switch`, `set`, `command.capture`, `sound` enhancements.

## Notes

- [ ] Ensure each new primitive includes validation, execution behavior, docs updates, and automated tests.
- [ ] Preserve deterministic, user-friendly output and graceful handling of expected setup gaps.

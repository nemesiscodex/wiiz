# Ink Wizard Guide

## Ink Mental Model

- Build the TUI as React components.
- Use `render(<App />)` from `ink` as the CLI entrypoint.
- Keep the process alive by listening to input (`useInput`) or other active async work.
- Exit through `useApp().exit()` for explicit lifecycle control.

## Minimal Wizard Structure

Use this shape for a step-driven wizard:

1. A step map keyed by step ID.
2. A current step ID in state.
3. A focused option index in state.
4. An answers object keyed by step ID.

Each option should include:

- A user-facing `label`
- A stable `action` ID (stored as answer)
- Optional `nextStepId`
- Optional `done` flag

## CLI Initialization Checklist

1. Install runtime deps: `ink`, `react`
2. Install dev deps: `typescript`, `tsx`, `@types/react`
3. Add scripts:
   - `dev`: run the TypeScript entrypoint directly with `tsx`
   - `build`: compile with `tsc`
   - `start`: execute compiled JS
4. Create `src/cli.tsx` with `render()` and `waitUntilExit()`

## Wizard Input Handling Pattern

- Handle arrow keys for focus movement.
- Handle Enter for selection.
- Handle cancel keys (`q`, `Escape`) globally.
- Clamp cursor indices between `0` and `options.length - 1`.
- Reset cursor when moving to another step.

## Transition And State Practices

- Keep transitions declarative in step data.
- Validate every `nextStepId` before changing steps.
- Store semantic answer values (`action` IDs), not formatted text.
- Support terminal steps with `done: true`.

## Rendering Practices

- Render question and options in a fixed, predictable structure.
- Prefix focused option with an obvious marker (`›`), others with spacing.
- Keep lines short for narrow terminals.
- Show a one-line keyboard hint at the bottom.

## Operational Practices

- Return a final result object from the wizard (`complete` or `cancelled`).
- Print final summary after the Ink app exits.
- Keep wizard logic in components and data files; keep `cli.tsx` thin.
- Add tests for branch transitions if the wizard controls production actions.

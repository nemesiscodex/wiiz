---
name: ink-wizard-tui
description: Build and extend Ink-based command-line wizard TUIs in Node.js/TypeScript. Use when creating or updating interactive CLI flows where each step asks a question and presents selectable options/actions, including keyboard navigation, step transitions, exit handling, and minimal project scaffolding for Ink.
---

# Ink Wizard TUI

Use this skill to build question-driven terminal wizards with Ink.

## Execute This Workflow

1. Initialize or align the CLI project for Ink.
2. Implement the minimal wizard component set.
3. Wire keyboard input, step transitions, and completion/cancel behavior.
4. Keep the UI simple, stable, and deterministic.

## 1) Initialize Ink In A CLI

Use one of these paths:

- New project: `npx create-ink-app --typescript my-cli`
- Existing Node CLI project: install `ink react` and run with `tsx` during development.

For existing projects, set up:

```bash
npm install ink react
npm install -D typescript tsx @types/react
```

Use this baseline file structure:

```text
src/
  cli.tsx
  WizardApp.tsx
  wizard.ts
  types.ts
```

Use [`assets/wizard-template`](assets/wizard-template) as the default starter.

## 2) Implement The Core Wizard Pieces

Implement only the required pieces:

- `types.ts`: Step and option type definitions.
- `wizard.ts`: Declarative step data (`question`, `options`, transition targets).
- `WizardApp.tsx`: Stateful renderer + input handler.
- `cli.tsx`: Ink `render()` entrypoint and lifecycle glue.

Follow the template paths:

- [`assets/wizard-template/src/types.ts`](assets/wizard-template/src/types.ts)
- [`assets/wizard-template/src/wizard.ts`](assets/wizard-template/src/wizard.ts)
- [`assets/wizard-template/src/WizardApp.tsx`](assets/wizard-template/src/WizardApp.tsx)
- [`assets/wizard-template/src/cli.tsx`](assets/wizard-template/src/cli.tsx)

## 3) Input And Transition Rules

Implement these defaults:

- Up/Down arrows move option focus.
- Enter confirms the focused option.
- `q` or `Escape` cancels and exits.
- Reset cursor to option `0` when advancing to a new step.
- Treat missing `nextStepId` or `done: true` as terminal.

Record answers as action IDs, not display labels.

## 4) Best Practices

- Keep step configuration declarative; avoid embedding branching logic in JSX.
- Use stable IDs (`step.id`, `option.action`) and avoid using labels as keys.
- Print completion/cancel summaries outside the visual wizard frame.
- Validate transitions (`nextStepId` must exist) before rendering.
- Keep each step single-purpose; split large menus into more steps.

## References

Read [`references/ink-wizard-guide.md`](references/ink-wizard-guide.md) for:

- Ink mental model for TUIs.
- Recommended project layout and lifecycle patterns.
- Additional implementation checks for robust wizard behavior.

# wiiz

`wiiz` turns repository setup into a repeatable CLI flow.

Instead of maintaining a setup document that drifts, you define onboarding once in `.wiiz/wizard.yaml` and run it for humans, scripts, and LLM-driven tooling.

## What You Can Do

- collect required setup values with prompts
- offer constrained choices for environment or runtime options
- reuse existing `.env` values with safe previews
- gate risky actions behind explicit confirmation
- write files, append snippets, and generate env files
- check required tools before continuing
- optionally run setup commands with user consent
- export a stable machine-readable description with `onboard llm`

## Quick Start

Run the interactive flow:

```bash
bun run onboard run
```

Run the same onboarding non-interactively:

```bash
bun run onboard run --values .wiiz/values.example.json
```

Validate a config:

```bash
bun run onboard validate
```

Generate a stable JSON description for tools:

```bash
bun run onboard llm
```

If you do not have a config yet, `wiiz` exits cleanly and tells you what to do next. You can also install the built-in authoring skill:

```bash
bun run onboard skill
```

That installs `wiiz-yaml-author` at `.agents/skills/wiiz-yaml-author/SKILL.md` so an LLM can generate `.wiiz/wizard.yaml` and `.wiiz/values.example.json`.

## Simple Example

This example collects two values, asks for confirmation, and writes a `.env` file. If `.env` already exists, `env.write` only updates the listed keys when `overwrite: true` and keeps unrelated content in place. Values with spaces are written with double quotes.

```yaml
version: 1
name: Example Repo Setup
steps:
  - id: service-url
    type: input
    message: Enter service URL
    var: SERVICE_URL
    envFile: .env
    envKey: SERVICE_URL
    sensitive: false
    required: true
    default: https://localhost:3000
    validateRegex: "^https?://.+"

  - id: runtime-env
    type: select
    message: Choose runtime environment
    var: RUNTIME_ENV
    envFile: .env
    sensitive: false
    options:
      - label: Development
        value: development
      - label: Production
        value: production

  - id: confirm-setup
    type: confirm
    message: Continue with setup for {{RUNTIME_ENV}}?
    default: "yes"

  - id: write-env
    type: env.write
    path: .env
    overwrite: true
    entries:
      - key: SERVICE_URL
        value: "{{SERVICE_URL}}"
      - key: RUNTIME_ENV
        value: "{{RUNTIME_ENV}}"
```

## Commands

Default config path: `.wiiz/wizard.yaml`

- `bun run onboard run [--config <path>] [--dry-run] [--values <file.json>]`
- `bun run onboard validate [--config <path>]`
- `bun run onboard llm [--config <path>]`
- `bun run onboard skill [--force]`

## Documentation

- [Config Reference](/Users/julio/personal/repo-onboard/docs/config-reference.md)
- [Examples](/Users/julio/personal/repo-onboard/docs/examples.md)
- [LLM Mode](/Users/julio/personal/repo-onboard/docs/llm-mode.md)
- [Development](/Users/julio/personal/repo-onboard/docs/development.md)

## Contributing

Changes to command behavior should preserve the project’s CLI contract:

- handle missing setup files gracefully
- prefer actionable guidance over raw stack traces
- reserve non-zero exits for real unexpected failures
- keep output deterministic and easy to recover from
- add automated tests for every new command surface and primitive

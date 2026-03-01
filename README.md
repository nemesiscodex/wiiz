# wiiz

`wiiz` turns repository setup into a repeatable CLI flow.

Instead of maintaining a setup document that drifts, you define onboarding once in `.wiiz/wizard.yaml` and run it for humans, scripts, and LLM-driven tooling.

## What You Can Do

- collect required setup values with prompts
- offer constrained choices for environment or runtime options
- reuse existing `.env` values with safe previews
- gate risky actions behind explicit confirmation
- branch into different setup paths from one earlier choice
- bundle related setup steps under one shared working directory
- write files, append snippets, and generate env files
- check required tools before continuing
- optionally run setup commands with user consent
- export a stable machine-readable description with `wiiz llm`
- inspect supported primitives with `wiiz help list` and `wiiz help <primitive>`

## Quick Start

Run the interactive flow:

```bash
wiiz run
```

Run the same onboarding non-interactively:

```bash
wiiz run --values .wiiz/values.example.json
```

Validate a config:

```bash
wiiz validate
```

Generate a stable JSON description for tools:

```bash
wiiz llm
```

Browse the primitive reference:

```bash
wiiz help list
wiiz help env.write
```

If you do not have a config yet, `wiiz` exits cleanly and tells you what to do next. You can also install the built-in authoring skill:

```bash
wiiz skill
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

- `wiiz help`
- `wiiz help list`
- `wiiz help <primitive>`
- `wiiz run [--config <path>] [--dry-run] [--values <file.json>]`
- `wiiz validate [--config <path>]`
- `wiiz llm [--config <path>]`
- `wiiz skill [--force]`

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

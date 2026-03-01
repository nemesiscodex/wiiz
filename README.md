# wiiz

**Getting started section—as an interactive wizard.** Define the steps once; run `wiiz run` whenever you or someone new needs to get the project running.

---

## Why wiiz?

Normally you read the README and follow the Getting Started guide step by step. You need these env vars, that API key, these commands installed—prerequisites. Maybe you're setting up for production vs development, so different steps apply.

**Why not streamline that?** wiiz turns the Getting Started section into an interactive wizard. You describe it once in `.wiiz/wizard.yaml`: what env vars to collect, which tools must be installed, what commands to run. Then anyone can clone the repo and quickly get started:

```bash
npx wiiz run
```

The wizard can guide them through everything—no flipping back to the README, no copy-paste from Slack. One place for onboarding, one command to run it. For you when you spin up a new machine, for new hires, for open source projects.

---

## What It Can Do

- collect required setup values with prompts
- offer constrained choices for environment or runtime options
- reuse existing `.env` values with safe previews
- gate risky actions behind explicit confirmation
- branch into different setup paths from one earlier choice
- bundle related setup steps under one shared working directory
- write files, append snippets, and generate env files
- check required tools before continuing
- optionally run setup commands with user consent
- inspect supported primitives with `wiiz help list` and `wiiz help <primitive>`

## Quick Start

Run the interactive flow:

```bash
npx wiiz@latest run
```
or with bunx:
```bash
bunx wiiz@latest run
```

If you do not have a config yet, `wiiz` exits cleanly and tells you what to do next. You can also install the built-in authoring skill, and ask your favorite LLM to generate a config for you:

```bash
npx wiiz skill
```

That installs `wiiz-yaml-author` at `.agents/skills/wiiz-yaml-author/SKILL.md` so an LLM/agent can generate `.wiiz/wizard.yaml` and `.wiiz/values.example.json`.

Validate a config:

```bash
npx wiiz validate
```

Browse the primitive reference:

```bash
npx wiiz help list
npx wiiz help env.write
```



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

- [Config Reference](docs/config-reference.md)
- [Examples](docs/examples.md)
- [LLM Mode](docs/llm-mode.md)
- [Development](docs/development.md)

## Contributing

Changes to command behavior should preserve the project’s CLI contract:

- handle missing setup files gracefully
- prefer actionable guidance over raw stack traces
- reserve non-zero exits for real unexpected failures
- keep output deterministic and easy to recover from
- add automated tests for every new command surface and primitive

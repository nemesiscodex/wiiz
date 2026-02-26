# repo-onboard

Config-driven repository onboarding CLI with interactive and non-interactive execution.

## Commands

- `bun run onboard run [--config <path>] [--dry-run] [--values <file.json>]`
- `bun run onboard validate [--config <path>]`
- `bun run onboard llm [--config <path>]`
- `bun run onboard skill [--force]`

Default config path is `.onboard/wizard.yaml`.

## Quick Start

1. Copy `.onboard/wizard.example.yaml` to `.onboard/wizard.yaml`.
2. Customize wizard steps for your repository.
3. Run interactive mode:

```bash
bun run onboard run
```

Run non-interactive mode:

```bash
bun run onboard run --values .onboard/values.example.json
```

Generate machine-readable spec for LLMs/tools:

```bash
bun run onboard llm
```

Install the built-in skill for generating onboarding configs:

```bash
bun run onboard skill
```

This installs `repo-onboard-yaml-author` at `.agents/skills/repo-onboard-yaml-author/SKILL.md`.
Use that skill with an LLM to generate `.onboard/wizard.yaml` and `.onboard/values.example.json`.

## Step Types

### `input`

Collect a text value and store it in `var`.

```yaml
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
```

### `select`

Collect one value from options and store it in `var`.

```yaml
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
```

If `envFile` is set and the variable already exists in that file, onboarding will:
1. Show a preview based on sensitivity defaults/override.
2. Ask whether to keep the existing value or replace it.
3. Never print the full secret value to the terminal.

You can control masking with `sensitive` on `input`/`select` steps:
- `input` default: `sensitive: true` (masked preview `ab**`)
- `select` default: `sensitive: true` (masked preview `ab**`)
- explicit `sensitive: true`: masked preview (`ab**`)
- `sensitive: false`: show full preview value

### `file.write`

Write interpolated content into a file. Fails if target exists unless `overwrite: true`.

```yaml
- id: write-config
  type: file.write
  path: config/app.conf
  overwrite: false
  content: |
    endpoint={{SERVICE_URL}}
```

### `file.append`

Append interpolated content into a file. Creates file when missing unless `createIfMissing: false`.

```yaml
- id: append-readme
  type: file.append
  path: README.md
  createIfMissing: true
  content: "\nService URL: {{SERVICE_URL}}\n"
```

### `env.write`

Generate an env file from explicit entries. Fails if target exists unless `overwrite: true`.

```yaml
- id: write-env
  type: env.write
  path: .env
  entries:
    - key: SERVICE_URL
      value: "{{SERVICE_URL}}"
    - key: RUNTIME_ENV
      value: "{{RUNTIME_ENV}}"
```

### `command.run`

Ask for permission and run a shell command when the user approves.
In non-interactive mode (`--values`), this primitive is skipped by default.

```yaml
- id: install-deps
  type: command.run
  command: bun install
  consentMessage: Install dependencies now?
```

### `command.check`

Verify a command exists in PATH. If missing, print install guidance and end onboarding early.

```yaml
- id: check-bun
  type: command.check
  command: bun
  installHint: Bun is required. Install it and re-run onboarding.
```

## Interpolation

- Use `{{var}}` to reference previously collected values.
- Use `\{{` to emit literal `{{`.
- Validation fails when an operation references a variable not collected in a prior prompt step.

## LLM Mode Output

`onboard llm` prints JSON with stable keys:

- `version`, `name`, `configPath`
- `inputs`
- `steps`
- `operations`
- `requirements`
- `safety`
- `exampleValues`

Use `exampleValues` as a template for a values file passed to `run --values`.

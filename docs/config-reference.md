# Config Reference

`wiiz` reads a config file from `.wiiz/wizard.yaml` by default.

Each config defines ordered `steps` that collect values, show guidance, and perform file or command operations.

## Prompt Steps

### `input`

Collect a free-form text value and store it in `var`.

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

Collect one value from a fixed list and store it in `var`.

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

If `envFile` is set and the variable already exists there, onboarding will:

1. Show a preview based on sensitivity settings.
2. Ask whether to keep the existing value or replace it.
3. Avoid printing the full secret value to the terminal.

Masking behavior for `input` and `select`:

- default: `sensitive: true`, preview is masked (`ab**`)
- explicit `sensitive: true`: preview is masked
- `sensitive: false`: preview is shown in full

## Flow Control Steps

### `confirm`

Require an explicit checkpoint before a risky or important transition.

- Interactive mode prompts `Yes/No`
- Non-interactive mode (`--values`) uses `default`
- If `default` is omitted, non-interactive mode treats it as `no`
- A declined confirmation stops onboarding unless `abortOnDecline: false`
- Optional `var` stores the result as `"yes"` or `"no"`

```yaml
- id: confirm-destructive
  type: confirm
  message: Continue with database reset?
  var: CONTINUE_RESET
  default: "no"
  abortOnDecline: true
```

### `match`

Choose exactly one nested branch based on a previously collected variable.

- `var` must reference a variable collected earlier in the flow
- each case must define exactly one of `equals` or `oneOf`
- the first matching case runs
- `default` is optional and runs when no case matches
- variables collected inside a branch are scoped to that branch and are not available to later top-level steps

```yaml
- id: branch-by-env
  type: match
  var: RUNTIME_ENV
  cases:
    - equals: production
      steps:
        - id: prod-note
          type: note
          message: Production checks enabled.
    - oneOf: [development, local]
      steps:
        - id: dev-note
          type: note
          message: Development helpers enabled.
  default:
    steps:
      - id: unknown-env
        type: display
        message: Using custom runtime settings.
```

### `group`

Bundle nested steps under a shared wrapper.

- `when` on the group gates the whole block
- `cwd` sets the base directory for nested file paths, env file paths, banner paths, and command execution
- nested steps can still define their own `when` conditions and step-specific `cwd` where supported
- in non-interactive mode, prompts inside a `group` only require values when the group actually runs

```yaml
- id: setup-files
  type: group
  cwd: scripts
  steps:
    - id: write-local-file
      type: file.write
      path: output.txt
      overwrite: true
      content: "generated\n"
```

## Output and File Steps

### `display` / `note`

Render interpolated informational text in command output.

```yaml
- id: show-target
  type: display
  message: Preparing deployment for {{RUNTIME_ENV}}
```

### `ascii` / `banner`

Render interpolated banner or ASCII content. Use inline `content` for short snippets or `path` for reusable text files.

```yaml
- id: section-header
  type: ascii
  path: .wiiz/logo.txt
```

### `file.write`

Write interpolated content into a file. Fails if the target already exists unless `overwrite: true`.

```yaml
- id: write-config
  type: file.write
  path: config/app.conf
  overwrite: false
  content: |
    endpoint={{SERVICE_URL}}
```

### `file.append`

Append interpolated content into a file. Creates the file when missing unless `createIfMissing: false`.

```yaml
- id: append-readme
  type: file.append
  path: README.md
  createIfMissing: true
  content: "\nService URL: {{SERVICE_URL}}\n"
```

### `env.write`

Generate an env file from explicit key/value entries. Fails if the target exists unless `overwrite: true`. When overwrite is enabled, existing env files are merged in place: configured keys are updated, unrelated lines are preserved, and missing keys are appended. Values containing spaces or tabs are written with double quotes.

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

## Command Steps

### `command.run`

Ask for permission, then run a shell command if the user approves. In non-interactive mode, this step is skipped by default.

```yaml
- id: install-deps
  type: command.run
  command: bun install
  consentMessage: Install dependencies now?
```

### `command.check`

Verify that a command exists in `PATH`. If it does not, `wiiz` prints install guidance and ends onboarding early.

```yaml
- id: check-bun
  type: command.check
  command: bun
  installHint: Bun is required. Install it and re-run onboarding.
```

## Conditional Execution

Every step can include an optional `when` block to gate execution using previously collected values. Multiple conditions are combined with logical `AND`.

```yaml
- id: only-prod-note
  type: note
  when:
    var: RUNTIME_ENV
    equals: production
  message: Production checks enabled.
```

Supported `when` keys:

- `var` (required): variable name collected by an earlier step
- `equals`: run only when the value matches exactly
- `notEquals`: run only when the value differs
- `oneOf`: run only when the value is in the provided list
- `exists`: run only when the value is non-empty (`true`) or empty/missing (`false`)

## Interpolation

- Use `{{VAR_NAME}}` to reference previously collected values
- Use `\{{` to emit literal `{{`
- Validation fails if an operation references a variable that was not collected earlier

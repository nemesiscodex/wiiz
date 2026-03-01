# Examples

## Minimal Interactive Setup

Collect a couple of values, confirm intent, and write a `.env` file.

```yaml
version: 1
name: Example Repo Setup
steps:
  - id: service-url
    type: input
    message: Enter service URL
    var: SERVICE_URL
    required: true
    default: https://localhost:3000

  - id: runtime-env
    type: select
    message: Choose runtime environment
    var: RUNTIME_ENV
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

## Tool Check Before Setup

Verify a required dependency exists before file operations run.

```yaml
version: 1
name: Bun Check
steps:
  - id: check-bun
    type: command.check
    command: bun
    installHint: Bun is required. Install it and re-run onboarding.

  - id: setup-note
    type: note
    message: Bun is available. Continue with project setup.
```

## Optional Command With Consent

Ask before running a setup command.

```yaml
version: 1
name: Optional Install
steps:
  - id: install-deps
    type: command.run
    command: bun install
    consentMessage: Install dependencies now?
```

## Conditional Step

Run a step only for one selected environment.

```yaml
version: 1
name: Conditional Production Note
steps:
  - id: runtime-env
    type: select
    message: Choose runtime environment
    var: RUNTIME_ENV
    options:
      - label: Development
        value: development
      - label: Production
        value: production

  - id: prod-note
    type: note
    when:
      var: RUNTIME_ENV
      equals: production
    message: Production checks enabled.
```

## Match Branching

Run one nested branch based on a previously selected value.

```yaml
version: 1
name: Branch By Environment
steps:
  - id: runtime-env
    type: select
    message: Choose runtime environment
    var: RUNTIME_ENV
    options:
      - label: Development
        value: development
      - label: Production
        value: production

  - id: branch-by-env
    type: match
    var: RUNTIME_ENV
    cases:
      - equals: production
        steps:
          - id: prod-note
            type: note
            message: Run the production checklist.
      - equals: development
        steps:
          - id: dev-note
            type: note
            message: Run the local setup helpers.
```

## Grouped Steps

Run multiple nested steps from a shared working directory.

```yaml
version: 1
name: Grouped File Setup
steps:
  - id: ask-name
    type: input
    message: Enter your name
    var: NAME

  - id: write-generated-files
    type: group
    cwd: scripts
    steps:
      - id: write-profile
        type: file.write
        path: profile.txt
        overwrite: true
        content: "name={{NAME}}\n"
```

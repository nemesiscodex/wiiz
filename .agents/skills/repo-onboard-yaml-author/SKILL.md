---
name: repo-onboard-yaml-author
description: Generate .onboard/wizard.yaml and .onboard/values.example.json for repository onboarding with repo-onboard. Use when a user wants to create or update onboarding wizard config from an existing repository's setup requirements, environment variables, and developer workflows.
---

# Repo Onboard YAML Author

Build onboarding config that works with repo-onboard CLI.

## Workflow

1. Inspect repository setup sources.
- Read README, CONTRIBUTING, setup docs, .env.example, docker compose files, package scripts, and CI configs.
- Extract required environment variables, selectable options, and file mutations needed for a first-time setup.

2. Define prompt variables first.
- Add `input` steps for free-text values.
- Add `select` steps for constrained values.
- For env-related prompts, set `envFile` (and optional `envKey`) to allow keep/replace from existing files.
- Sensitivity defaults: prompts are sensitive by default. Set `sensitive: false` only for non-secret values where full preview is useful.
- Keep identifiers stable: use uppercase variable names and kebab-case step ids.
- Prefer required inputs unless a default is trustworthy.

3. Define operation steps after prompts.
- Use `env.write` for `.env` generation.
- Use `command.check` to verify required tooling before file operations.
- Use `command.run` for optional setup commands that need user consent.
- Use `file.write` for full-file templates.
- Use `file.append` for additive setup notes.
- Reference prior values with `{{VAR_NAME}}`.
- Escape literal braces with `\{{`.

4. Enforce safe defaults.
- Omit overwrite flags unless replacement is explicitly intended.
- Keep flow sequential (no branching).
- Place file operations after all referenced variables are collected.

5. Produce deterministic outputs.
- Write `.onboard/wizard.yaml`.
- Optionally write `.onboard/values.example.json` with realistic placeholders.
- Keep content concise and editable by humans.

## Output Contract

When generating onboarding artifacts, produce these files:

1. `.onboard/wizard.yaml`
- Must use `version: 1`.
- Must include `name` and non-empty ordered `steps`.
- Must only use supported step types: `input`, `select`, `file.write`, `file.append`, `env.write`, `command.run`, `command.check`.

2. `.onboard/values.example.json`
- Map each prompt `var` to a representative sample value.
- Ensure select values match declared option `value` exactly.

## Quality Checks

Before finishing:

1. Verify every `{{VAR}}` token is defined by a prior prompt step.
2. Verify all select options have unique `value` fields.
3. Verify regex patterns are valid when present.
4. Verify non-interactive execution can run with values JSON.

If repo-onboard CLI is available, run:

- `onboard validate --config .onboard/wizard.yaml`
- `onboard llm --config .onboard/wizard.yaml`

If unavailable, still generate both files and explain unverified checks.

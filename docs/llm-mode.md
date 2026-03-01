# LLM Mode

Run:

```bash
wiiz llm
```

This prints a stable JSON description of the onboarding config so LLMs, scripts, and automation tools can inspect the flow without executing it.

## Output Keys

`wiiz llm` includes these top-level keys:

- `version`
- `name`
- `configPath`
- `inputs`
- `steps`
- `operations`
- `requirements`
- `safety`
- `exampleValues`

## Common Uses

- generate a starter values file for `run --values`
- inspect required inputs before running onboarding
- expose setup requirements to other tools
- document automation and safety expectations without parsing YAML directly

## Non-Interactive Runs

Use `exampleValues` as the starting template for a values file:

```bash
wiiz run --values .wiiz/values.example.json
```

In non-interactive mode:

- prompt values come from the JSON file
- `confirm` uses its `default` value, or `no` if omitted
- `command.run` is skipped by default
- only the selected `match` branch needs values

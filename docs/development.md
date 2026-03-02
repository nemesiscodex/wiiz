# Development

This project is built with Bun, TypeScript, Ink, and React.

## Local Commands

Run the main checks:

```bash
bun test
bun run build
bun run typecheck
```

Run the CLI directly while developing:

```bash
bun run cli --help
bun run start
node dist/index.js help
```

## Project Rules

Changes to command behavior should follow the repository contract:

- handle expected setup gaps gracefully
- explain what happened and what to do next
- reserve non-zero exits for unexpected failures
- keep CLI output deterministic and user-friendly
- add tests for every new command surface and primitive type

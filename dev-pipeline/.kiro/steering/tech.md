# Tech

## Stack

- **Language:** TypeScript (strict mode), targeting ES2022.
- **Module system:** ESM only (`"type": "module"`). Use `NodeNext` module resolution.
- **Runtime:** Node.js `>=20`.
- **Package manager:** npm (a `package-lock.json` is committed).

## Key libraries

- `cac` — CLI command/option parsing.
- `prompts` — interactive prompts (skipped under `--yes`).
- `handlebars` — template rendering (`.hbs` files under `templates/`).
- `fs-extra` — filesystem operations.
- `zod` (v4) — schema validation.
- `picocolors` — terminal colors.
- `vitest` — test runner.
- `tsx` — run/develop TypeScript directly without a build step.

## Conventions

- **Relative imports must include the `.js` extension** (NodeNext ESM requirement), even though source files are `.ts`. Example: `import { runInitCommand } from './commands/init.js'`.
- Strict TypeScript: no implicit `any`, handle `undefined`/`null` explicitly.
- Prefer explicit `interface`/`type` definitions; export shared types from a `types.ts` in each core module.
- CLI errors bubble up to the bin entry point, which prints them in red and exits with code 1. Throw `Error` with a clear message rather than calling `process.exit` mid-logic.
- Use `picocolors` for any user-facing colored output.
- Honor `--dry-run`, `--yes`, and `--force` flags consistently; default to non-destructive behavior.

## Common commands

```bash
# Develop / run the CLI from source
npm run dev -- init --tool claude --yes --dry-run

# Type-check without emitting
npm run typecheck

# Build to dist/ (used by prepublishOnly)
npm run build

# Run the full test suite once
npm test

# Watch tests during development
npm run test:watch

# Verify the publishable package contents
npm run pack:check

# Quick init smoke check
npm run init:smoke
```

## Build & publish

- `npm run build` compiles `src/` to `dist/` via `tsconfig.build.json` (declarations + sourcemaps, `rootDir: src`).
- Published artifact includes `dist`, `config`, `templates`, and `README.md` (see `files` in `package.json`).
- Two bins are exposed: `opsx-dev-pipeline` and `create-opsx-dev-pipeline`.

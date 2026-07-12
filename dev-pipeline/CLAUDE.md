# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test

- `npm run build` — Compile TypeScript via `tsc -p tsconfig.build.json`
- `npm run typecheck` — Type-check without emitting: `tsc --noEmit`
- `npm test` — Run all tests: `vitest run`
- `npm run test:watch` — Watch mode: `vitest`
- `npm run dev` — Run CLI from source: `tsx src/bin/opsx-dev-pipeline.ts`
- `npm run format` — Format all files: `biome format --write .`
- `npm run lint` — Lint all files: `biome check .`

## Architecture

- **Pure Node.js CLI** (no frontend). Published as `opsx-dev-pipeline` on npm, installed globally.
- **Subdirectory of a monorepo**: `dev-pipeline/` lives inside `My-Skills/` at `git@github.com:ZhaoYis/My-Skills.git`. The package root is NOT the repo root — `resolvePackageRoot()` detects it by looking for `package.json` + `config/tools.json` + `templates/common/base/README.md.hbs`.
- **`test-pipeline/` is a separate package** with its own `package.json` and `node_modules/`. It depends on the parent via `"opsx-dev-pipeline": "file:.."` and is excluded from the main vitest config. It runs AI-agent-driven E2E tests.
- **OpenSpec prerequisite**: The `openspec` CLI must be installed globally before using `opsx-dev-pipeline`.

## TypeScript / Module System

- **ESM only** (`"type": "module"`), **NodeNext** module resolution.
- **All relative imports MUST use `.js` extension** even for `.ts` source files: `import { foo } from './bar.js'`.
- **Strict mode** enabled. No implicit `any`, handle `undefined`/`null` explicitly.
- Explicit `interface`/`type` definitions; shared types exported from `types.ts` in each core module.

## Code Conventions

- **Test files**: kebab-case (`*.test.ts`), mirroring the module under test.
- **CLI flags**: Honor `--dry-run`, `--yes`, `--force` consistently. Default to non-destructive.
- **Error handling**: Throw `Error` with clear messages. Errors bubble to the bin entry point, print in red (`picocolors`), exit code 1.
- **User-facing output**: Use `picocolors` for colored terminal output.
- **Formatting**: Biome (config at `biome.json`). Quotes: single, semicolons: always, trailing commas: always, 2-space indent. A PostToolUse hook auto-formats every edited file on Write/Edit.
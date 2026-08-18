## Why

The dev-pipeline CLI currently only supports Java Spring Boot as a backend tech stack. Many teams and AI-assisted projects use Python (FastAPI) for backend services — especially in the AI/ML workflow automation domain this tool targets. Adding Python FastAPI as a backend tech stack option broadens the tool's applicability without requiring users to manually adapt Java-centric config templates.

## What Changes

- Add `python-fastapi` as a new `TechStackId` in the tech stack registry
- Register a new tech stack definition with `parentStack: 'backend'`
- Create a new config template `config.backend.python-fastapi.yaml.hbs` with Python-specific coding conventions (PEP 8, Ruff, pytest, Pydantic, SQLAlchemy/Alembic, mypy) and FastAPI project metadata
- No changes to CLI interface, schema templates, or existing tech stacks — fully backward compatible

## Capabilities

### New Capabilities
- `python-fastapi-backend`: Tech stack definition and config template for Python FastAPI backend projects, including Python-specific coding conventions, tooling (Ruff, pytest, mypy), and framework metadata (FastAPI, Pydantic, SQLAlchemy, Alembic)

### Modified Capabilities
(none — existing capabilities are unaffected)

## Impact

- **Code**: `src/core/tech-stack/types.ts` (union type), `src/core/tech-stack/registry.ts` (new entry)
- **Templates**: New file `src/templates/common/config/config.backend.python-fastapi.yaml.hbs`
- **CLI**: No interface changes — `collectInputs.ts` auto-generates choices from registry
- **Build**: `npm run build` required to update `dist/`
- **Tests**: Verify tech stack resolution and config template rendering for the new stack
- **Backward compatibility**: Fully additive — no existing behavior changes

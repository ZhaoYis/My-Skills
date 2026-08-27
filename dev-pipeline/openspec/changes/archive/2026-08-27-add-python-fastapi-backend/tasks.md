## 1. Type System Update

- [x] 1.1 Add `'python-fastapi'` to the `TechStackId` union type in `src/core/tech-stack/types.ts`

## 2. Tech Stack Registry

- [x] 2.1 Add a new `python-fastapi` entry to `TECH_STACK_REGISTRY` in `src/core/tech-stack/registry.ts` with displayName `Python FastAPI`, parentStack `backend`, and description covering Python 3.10+, FastAPI, Pydantic, SQLAlchemy/Tortoise ORM, pytest, Ruff, mypy

## 3. Config Template

- [x] 3.1 Create `src/templates/common/config/config.backend.python-fastapi.yaml.hbs` with Python-specific coding conventions (PEP 8, Google-style docstrings, type hints, Ruff, pytest, mypy), FastAPI project metadata, and Python-appropriate rules (Pydantic schemas, Alembic migrations, async patterns)

## 4. Build & Verify

- [x] 4.1 Run `npm run build` to compile updated types and registry into `dist/`
- [x] 4.2 Run `npm test` to verify no regressions in existing tech stack resolution
- [x] 4.3 Manually verify the new template renders correctly by running init with `--stack backend --tech-stack python-fastapi --yes --dry-run` (or equivalent) and inspecting the generated config

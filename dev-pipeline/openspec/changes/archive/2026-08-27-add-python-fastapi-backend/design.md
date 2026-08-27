## Context

The dev-pipeline CLI uses a registry-based architecture for tech stacks. Each tech stack is defined in `src/core/tech-stack/registry.ts` with an id, displayName, description, and parentStack. The system automatically discovers tech stacks and presents them in interactive prompts. Config templates follow a naming convention: `config.<stack>.<tech-stack>.yaml.hbs`, with a fallback to `config.<stack>.yaml.hbs` when no tech-stack-specific template exists.

Current backend support:
- One tech stack: `java-spring-boot`
- One config template: `config.backend.java-spring-boot.yaml.hbs`
- Generic fallback: `config.backend.yaml.hbs` (currently contains Java-specific content)

The architecture already supports multiple tech stacks per parentStack — no structural changes needed.

## Goals / Non-Goals

**Goals:**
- Add `python-fastapi` as a valid backend tech stack option
- Provide Python-specific coding conventions in the generated config
- Maintain backward compatibility with existing Java Spring Boot support
- Follow existing patterns and conventions (registry-based, template-based)

**Non-Goals:**
- Add Django or other Python frameworks (out of scope for this change)
- Modify the generic `config.backend.yaml.hbs` fallback (it remains Java-centric for now)
- Add fullstack support (python-react combination)
- Change CLI interface or command structure
- Modify schema templates (they're language-agnostic)

## Decisions

**1. Registry entry structure**
Add a new entry to `TECH_STACK_REGISTRY` array in `src/core/tech-stack/registry.ts`:
```typescript
{
  id: 'python-fastapi',
  displayName: 'Python FastAPI',
  description: 'Python 3.10+, FastAPI, Pydantic, SQLAlchemy/Tortoise ORM, pytest, Ruff, mypy',
  parentStack: 'backend'
}
```
Rationale: Follows existing pattern. Description includes key libraries to help users understand the stack.

**2. Type system update**
Extend `TechStackId` union type in `src/core/tech-stack/types.ts`:
```typescript
export type TechStackId = 'java-spring-boot' | 'react-vite' | 'java-react' | 'python-fastapi';
```
Rationale: TypeScript requires explicit union members for type safety. This is the only way to add a new valid id.

**3. Config template approach**
Create new file `src/templates/common/config/config.backend.python-fastapi.yaml.hbs` instead of modifying the generic fallback.

Rationale:
- The generic fallback (`config.backend.yaml.hbs`) currently contains Java-specific content
- Tech-stack-specific templates override the fallback when present (see `buildInstallPlan.ts:332-343`)
- This approach isolates Python content and doesn't affect existing Java users
- Future: if a generic backend template is needed, it can be created separately

**4. Python coding conventions**
The new config template will include:
- PEP 8 style guide reference
- Google-style docstrings (not NumPy or Sphinx style)
- Type hints enforcement (PEP 484+)
- Ruff for linting and formatting (modern, fast, replaces flake8+isort+black)
- pytest for testing (industry standard)
- mypy for static type checking
- Pydantic for data validation (FastAPI's default)
- SQLAlchemy or Tortoise ORM for database access
- Alembic for migrations

Rationale: These are modern, widely-adopted Python tools that align with FastAPI's async-first philosophy. Google-style docstrings are readable and commonly used in industry.

**5. Template content structure**
Mirror the Java template structure:
- Language requirements (zh/en)
- Coding conventions section (Python-specific)
- Project metadata (FastAPI, Python version, ORM, testing tools)
- Rules section (proposal, api-design, specs, design)
- Pipeline routes (trivial, standard, full)

Rationale: Consistency with existing templates makes maintenance easier.

## Risks / Trade-offs

**Risk: Generic fallback remains Java-centric**
If a user selects `backend` but no tech stack (currently impossible in interactive mode, but possible via API), they get Java conventions even if they intended Python.

Mitigation: The interactive CLI always prompts for tech stack when multiple options exist. The API path validates tech stack against registry. This is an acceptable limitation for now. If needed later, a generic backend template can be added.

**Risk: Python conventions may not fit all projects**
Some teams use different style guides (NumPy docstrings, black instead of ruff, etc.).

Mitigation: The generated config is a starting point. Users can customize it after initialization. The template provides sensible defaults for modern FastAPI projects.

**Risk: Template duplication**
Both Java and Python templates have similar structure (language requirements, pipeline routes).

Mitigation: Acceptable duplication. The templates are small and diverge in the important parts (coding conventions, project metadata). Extracting common parts into a shared partial would add complexity without significant benefit.

**Trade-off: No Django support**
Users wanting Django must use the generic backend template or manually adapt.

Mitigation: This change focuses on FastAPI due to its alignment with AI/ML workflows. Django can be added in a future change following the same pattern.

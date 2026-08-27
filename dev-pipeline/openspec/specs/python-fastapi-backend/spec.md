## Purpose

Lets users select Python FastAPI as their backend tech stack when initializing a dev-pipeline project, providing Python-specific coding conventions and framework metadata in the generated OpenSpec config.

## Requirements

### Requirement: Python FastAPI tech stack registration
The system SHALL register `python-fastapi` as a valid backend tech stack in the tech stack registry, making it discoverable alongside existing backend tech stacks.

#### Scenario: Registry contains python-fastapi
- **WHEN** the tech stack registry is queried for backend tech stacks
- **THEN** the returned list SHALL include an entry with id `python-fastapi`, displayName `Python FastAPI`, and parentStack `backend`

#### Scenario: Resolve python-fastapi by id
- **WHEN** `resolveTechStackId('python-fastapi')` is called
- **THEN** it SHALL return `'python-fastapi'` as a valid `TechStackId` without throwing

#### Scenario: Resolve invalid tech stack id
- **WHEN** `resolveTechStackId('python-django')` is called
- **THEN** it SHALL throw an error listing all valid tech stack ids including `python-fastapi`

### Requirement: Interactive CLI presents Python FastAPI option
The system SHALL present Python FastAPI as a selectable tech stack when the user chooses `backend` as their project stack in interactive mode.

#### Scenario: Backend stack shows python-fastapi
- **WHEN** user selects `backend` stack in interactive prompts
- **THEN** the tech stack choices SHALL include `Python FastAPI` with a description mentioning FastAPI, Python, and key libraries

#### Scenario: CLI flag selects python-fastapi
- **WHEN** user runs init with `--stack backend --tech-stack python-fastapi`
- **THEN** the system SHALL accept the combination without error and proceed with python-fastapi as the selected tech stack

### Requirement: Python-specific config template rendering
The system SHALL render a Python FastAPI-specific config template when `python-fastapi` is the selected tech stack, overriding the generic backend config.

#### Scenario: Config contains Python conventions
- **WHEN** config is rendered with tech stack `python-fastapi`
- **THEN** the rendered config SHALL include Python coding conventions (PEP 8, type hints, docstrings) instead of Java conventions (Javadoc)

#### Scenario: Config references FastAPI stack
- **WHEN** config is rendered with tech stack `python-fastapi`
- **THEN** the rendered config SHALL reference Python 3.10+, FastAPI, Pydantic, and appropriate Python tooling (Ruff, pytest, mypy)

#### Scenario: Config uses Python-appropriate rules
- **WHEN** config is rendered with tech stack `python-fastapi`
- **THEN** the rules section SHALL reference Python-relevant concerns (Pydantic schemas, async patterns, Alembic migrations) instead of Java-specific ones (DTOs, Flyway, JPA)

### Requirement: Type system includes python-fastapi
The `TechStackId` TypeScript type SHALL include `'python-fastapi'` as a valid union member.

#### Scenario: TypeScript compilation
- **WHEN** code references `'python-fastapi'` as a `TechStackId`
- **THEN** TypeScript compilation SHALL succeed without type errors
## 1. Configuration Schema and Validation

- [x] 1.1 Define route configuration schema in config.yaml template (add pipeline.routes section with trivial/standard/full definitions)
- [x] 1.2 Implement config validation logic to verify route configuration (check phases array contains valid values 0-7, includes Phase 0 and Phase 6)
- [x] 1.3 Add default route configuration to config.yaml template with three predefined routes
- [x] 1.4 Write unit tests for config validation (valid configs, missing fields, invalid phase numbers, missing required phases)

## 2. State Management Script Updates

- [x] 2.1 Add route field structure to state schema (choice, upgradedFrom, upgradedAt)
- [x] 2.2 Implement route initialization logic in init command (set default route to full if not specified)
- [x] 2.3 Add route validation in transition command (check target phase is in current route's phases array)
- [x] 2.4 Implement route upgrade command with validation (allow upgrade only, prevent downgrade, record history)
- [x] 2.5 Add backward compatibility logic (default to full route if route field missing in state file)
- [x] 2.6 Update state file output to include route information in get command
- [x] 2.7 Write unit tests for route validation in transitions (allowed phases, blocked phases)
- [x] 2.8 Write unit tests for route upgrade command (upgrade scenarios, downgrade prevention, history recording)
- [x] 2.9 Write integration tests for backward compatibility (old state files without route field)

## 3. Phase 0 Template Updates

- [x] 3.1 Add route evaluation section to phase-0-entrance.md.hbs after Step 2
- [x] 3.2 Implement AI recommendation logic based on change characteristics (trivial: small scope/no behavior change, standard: clear goal/controlled risk, full: high risk/core logic)
- [x] 3.3 Add user confirmation prompt using askTool (show recommendation with rationale, offer three route options)
- [x] 3.4 Implement route selection recording (call dev-pipeline-state.mjs decision command to record route_choice)
- [x] 3.5 Add logic to skip route evaluation for existing changes that already have route.choice in state
- [x] 3.6 Write template rendering tests to verify route evaluation section appears correctly

## 4. Build and Integration Testing

- [x] 4.1 Run npm run build to compile updated templates and scripts
- [x] 4.2 Run npm test to verify all existing tests pass
- [x] 4.3 Create end-to-end test scenario for trivial route (typo fix: Phase 0 → 2 → 6)
- [x] 4.4 Create end-to-end test scenario for standard route (feature development: Phase 0 → 1 → 2 → 5 → 6)
- [x] 4.5 Create end-to-end test scenario for full route (core logic change: Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7)
- [x] 4.6 Create test scenario for route upgrade (trivial → standard mid-flow)
- [x] 4.7 Create test scenario for backward compatibility (continue old change without route field)

## 5. Documentation and Examples

- [x] 5.1 Update README.md to document route tiering feature
- [x] 5.2 Add examples of when to use each route (trivial: typo/formatting/comments, standard: features/bug fixes/refactoring, full: core logic/database/security)
- [x] 5.3 Document route upgrade scenarios and restrictions
- [x] 5.4 Add troubleshooting section for common route-related issues

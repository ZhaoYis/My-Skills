---
name: verify
description: Run typecheck and tests to verify code changes are correct before committing.
---

## Steps

1. Run type checking: `npm run typecheck`
2. If typecheck passes, run the full test suite: `npm test`
3. Report results clearly:
   - If both pass: "All checks passed ✅"
   - If typecheck fails: list the errors and stop (don't run tests)
   - If tests fail: list the failing test names and summarize failures
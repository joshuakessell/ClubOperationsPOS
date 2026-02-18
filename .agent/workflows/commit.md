---
description: Commit and push changes (runs lint + typecheck first)
---
// turbo-all
1. Run lint:
   ```bash
   cd /Users/joshuakessell/Projects/ClubOperationsPOS && pnpm -r run lint
   ```

2. Run typecheck:
   ```bash
   cd /Users/joshuakessell/Projects/ClubOperationsPOS && pnpm -r run typecheck
   ```

3. If lint or typecheck fail, fix the issues before proceeding. Do NOT commit with errors.

4. Stage, commit, and push the changes. Use a conventional commit message.

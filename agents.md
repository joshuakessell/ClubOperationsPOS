## CI and Deployment Rules

### Deployment Architecture

The system uses AWS infrastructure:
- **API**: AWS App Runner (auto-scaling containers from ECR)
- **Frontends**: S3 + CloudFront (static hosting)
- **Database**: AWS RDS Postgres
- **Realtime**: AWS AppSync Events

### Environments

- **Demo/Development**: Auto-deploys on every push to `main`
  - URL: https://api-demo.joshuakessell.com, https://employee-demo.joshuakessell.com, https://customer-demo.joshuakessell.com
  - Demo mode enabled with automatic data reseeding
- **Production**: Deploys on git tags matching `v*` pattern
  - Configured via GitHub secrets with `_PROD` suffix
  - Demo mode disabled, migrations run automatically

Agents MUST:

- Use Turbo for builds (`pnpm turbo run build`)
- Ensure quality gates pass before committing: `pnpm lint && pnpm typecheck && pnpm spec:check`
- After every chat session, run `pnpm lint && pnpm typecheck` with no errors, then write an itemized commit message summarizing the changes, commit them, and push to the current branch.
- Keep API build output deterministic at `services/api/dist/index.js`
- Consult `docs/DEPLOYMENT.md` before modifying deployment pipelines
- Test Docker builds locally before pushing changes to Dockerfiles

Agents MUST NOT:

- Modify deployment scripts or infrastructure code without explicit request
- Change GitHub Actions workflows without understanding the full deployment pipeline
- Add new environment variables without updating both `.env.example` and deployment docs

## Code-Writing Docs (Index)

- `CONTRIBUTING.md` — engineering guide, quality gates, and repo conventions
- `SPEC.md` — business invariants; code must align with this index
- `docs/FILE_STRUCTURE.md` — canonical repo layout; update when structure changes
- `docs/database/DATABASE_SOURCE_OF_TRUTH.md` — database meaning and invariants (canonical)
- `docs/database/DATABASE_ENTITY_DETAILS.md` — entity contracts and field semantics (canonical)
- `apps/employee-register/src/app/ARCHITECTURE.md` — employee-register app layering and ownership rules
- `apps/customer-kiosk/src/app/ARCHITECTURE.md` — customer-kiosk app layering and ownership rules
- `apps/office-dashboard/src/app/ARCHITECTURE.md` — office-dashboard app layering and ownership rules

## File Size + Organization Rules

- Avoid bloated source files: no file under `apps/**/src` may exceed 400 lines without explicit approval.
- Prefer feature/domain folders; co-locate related state, hooks, UI, and utilities for the same responsibility.
- Split by single responsibility; avoid "god files" that centralize unrelated concerns.

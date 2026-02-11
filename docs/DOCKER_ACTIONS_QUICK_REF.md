# Docker + GitHub Actions Quick Reference

## 🚀 New Workflows at a Glance

| Workflow | When It Runs | What It Does | Time Saved |
|----------|-------------|--------------|------------|
| **ci-enhanced** | PR + push to `main` + manual | Build/typecheck/lint + Docker validation + compose + security | Main quality gate |
| **docker-image-scan** | Weekly + manual | Security scanning + SBOM generation | Compliance ready |
| **docker-multi-arch** | Manual trigger only | Builds ARM64 + AMD64 images | Cost optimization |
| **deploy** | Push to `main` + manual | Deploys dev API + frontends | Continuous dev delivery |
| **deploy-production** | Tag `v*` + manual | Deploys production API + frontends | Controlled release |
| **seed-demo** | Daily + manual | Seeds demo data via SSM tunnel | Consistent demo state |

---

## 🔧 Common Commands

### Locally Test What CI Does
```bash
# Build specific service (matches CI)
docker buildx build -f Dockerfile.api -t club-ops-api:local .

# Full integration test (matches docker-compose-test job)
docker compose up -d
curl http://localhost:3000/health

# Lint Dockerfile
docker run --rm -i hadolint/hadolint < Dockerfile.api

# Scan for vulnerabilities
docker run --rm -v $(pwd):/src aquasec/trivy image club-ops-api:local
```

### Check GitHub Actions Cache
```bash
# View cache usage in repo settings
https://github.com/<your-org>/ClubOperationsPOS/actions/caches
```

### Trigger Manual Builds
```bash
# Via GitHub CLI
gh workflow run ci-enhanced.yml
gh workflow run docker-multi-arch.yml --field push_to_ecr=true
```

---

## 🎯 Best Practices Enforced

### ✅ DO
- Use `cache-from` and `cache-to` for faster builds
- Pin base image versions (`node:22-alpine` not `node:latest`)
- Multi-stage builds (deps → builder → runner)
- Health checks in all Dockerfiles
- `.dockerignore` to reduce context size

### ❌ DON'T
- Build images sequentially (use matrix strategy)
- Skip security scanning on dependency updates
- Hard-code secrets in Dockerfiles or ENV
- Use `latest` tags in production
- Ignore image size warnings

---

## 📊 Monitoring Dashboard

### Key Metrics (Check Weekly)
1. **Build Time**: Target <5min with cache hit
2. **Image Size**: API <500MB, Frontends <200MB
3. **Security Issues**: 0 critical, <5 high
4. **Cache Hit Rate**: >80%

### Where to Check
- Build times: GitHub Actions → Workflows → Recent runs
- Image sizes: Workflow Summary after `docker-build-metrics`
- Security: Repository → Security → Code scanning alerts
- Cache stats: Settings → Actions → Caches

---

## 🔍 Troubleshooting Matrix

| Problem | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| Build takes 15+ minutes | Cache miss | Re-run `ci-enhanced` and inspect Docker cache logs |
| "Token expired" in ECR push | OIDC role issue | Check `AWS_ROLE_ARN` secret |
| Health check timeout | App startup issue | Increase `start_period` in Dockerfile |
| Image size spike | New dependencies | Review `pnpm-lock.yaml` changes |
| Hadolint warnings | Dockerfile quality | Address inline comments in output |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ GitHub Actions Workflow Triggers                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  PR → ci-enhanced.yml → Validate + Docker Build Test    │
│  ↓                                                       │
│  Merge → deploy.yml → Build → Push ECR → App Runner    │
│  ↓                                                       │
│  Nightly → cache-warmup → Pre-build layers              │
│  ↓                                                       │
│  Weekly → image-scan → Security check + SBOM            │
│                                                          │
└─────────────────────────────────────────────────────────┘

Docker Build Flow:
  deps stage → Install dependencies (cached)
     ↓
  builder stage → Compile TypeScript/Vite (cached)
     ↓
  runner stage → Minimal runtime (Alpine/nginx)
```

---

## 📝 Image Tagging Strategy

### Development
```
ECR_REPO/club-ops-api:dev-abc1234      # Commit SHA
ECR_REPO/club-ops-api:dev-latest       # Latest dev
ECR_REPO/club-ops-api:dev-20260211-143022  # Timestamp
```

### Production (Future)
```
ECR_REPO/club-ops-api:v1.2.3          # Semantic version
ECR_REPO/club-ops-api:prod-latest     # Production stable
ECR_REPO/club-ops-api:prod-abc1234    # Rollback reference
```

---

## 🛡️ Security Layers

1. **Build Time**
   - Hadolint → Dockerfile best practices
   - Trivy → Dependency vulnerabilities

2. **Pre-Deployment**
   - SBOM → Software composition
   - Secret scanning → Credential leaks

3. **Runtime**
   - Health checks → Container stability
   - AppRunner → Managed security patches

---

## 🚢 Deployment Flow

```bash
1. Commit to main
   ↓
2. CI validates build
   ↓
3. deploy.yml triggers
   ↓
4. Build Docker image
   ↓
5. Push to ECR with tags
   ↓
6. Update App Runner service
   ↓
7. Deploy frontends to S3/CloudFront
   ↓
8. Health check validation
   ↓
9. Deployment summary posted
```

**Rollback procedure:**
```bash
aws apprunner update-service \
  --service-arn $SERVICE_ARN \
  --source-configuration ImageRepository={ImageIdentifier=$ECR_URI:dev-PREVIOUS_SHA}
```

---

## 💡 Pro Tips

### Speed Up Local Development
```bash
# Use BuildKit for better caching
export DOCKER_BUILDKIT=1

# Cache node_modules between builds
docker volume create club-ops-pnpm-store
docker run -v club-ops-pnpm-store:/root/.local/share/pnpm/store ...
```

### Debug Failed Builds
```bash
# View build history
docker buildx history ls

# Inspect specific build
docker buildx history inspect <ref>

# Save failed stage for debugging
docker buildx build --target builder -t debug:latest .
docker run -it debug:latest sh
```

### Optimize Image Size
```bash
# Compare layer sizes
docker history club-ops-api:latest --no-trunc

# Analyze what's taking space
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  wagoodman/dive:latest club-ops-api:latest
```

---

## 🔗 Related Documentation

- [`DOCKER.md`](../DOCKER.md) - Comprehensive Docker guide
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) - AWS deployment architecture
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) - Development workflow
- [`GITHUB_ACTIONS_DOCKER.md`](./GITHUB_ACTIONS_DOCKER.md) - Full implementation details

---

## ⚙️ Configuration Files

```
.github/workflows/
├── ci-enhanced.yml           # Main CI pipeline ⭐
├── deploy.yml                # Dev deployment ⭐
├── docker-image-scan.yml     # Security scanning ✨
├── seed-demo.yml             # Demo data seeding
├── rollback.yml              # Manual rollback
├── deploy-frontends.yml      # Frontend-only deployment
└── docker-multi-arch.yml     # Multi-arch support 🆕

Dockerfile.*                  # Multi-stage build definitions
.dockerignore                 # Build context exclusions
docker-compose.yml            # Local development stack
```

**Legend:**
- ⭐ Critical path
- ✨ Enhanced
- 🆕 New workflow

---

**Last Updated:** 2026-02-11  
**Next Review:** When GitHub Actions or Docker versions update

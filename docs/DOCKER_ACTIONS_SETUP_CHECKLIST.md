# GitHub Actions Docker Setup Checklist

Use this checklist to enable and validate the new Docker workflows.

## 📋 Pre-Deployment Checklist

### 1. Repository Configuration
- [ ] Verify branch protection rules on `main`
- [ ] Enable GitHub Actions in repository settings
- [ ] Set Actions permissions to "Read and write permissions"
- [ ] Enable Security features: Dependabot alerts, Code scanning

### 2. Required Secrets (Already configured, verify these exist)
- [ ] `AWS_ROLE_ARN` - OIDC role for GitHub Actions
- [ ] `ECR_REPO_URI` - ECR repository URL
- [ ] `APP_RUNNER_SERVICE_ARN` - App Runner service ARN
- [ ] `DATABASE_URL_SECRET_ARN` - Secrets Manager ARN
- [ ] `KIOSK_TOKEN_SECRET_ARN` - Secrets Manager ARN
- [ ] `APPSYNC_EVENTS_HTTP_ENDPOINT` - AppSync endpoint

### 3. Required Variables
- [ ] `EMPLOYEE_BUCKET` - S3 bucket name
- [ ] `EMPLOYEE_DISTRIBUTION_ID` - CloudFront distribution
- [ ] `CUSTOMER_BUCKET` - S3 bucket name
- [ ] `CUSTOMER_DISTRIBUTION_ID` - CloudFront distribution

---

## 🚀 Deployment Steps

### Step 1: Commit New Workflows
```bash
git add .github/workflows/ci-enhanced.yml
git add .github/workflows/docker-image-scan.yml
git add .github/workflows/docker-multi-arch.yml
git add docs/GITHUB_ACTIONS_DOCKER.md
git add docs/DOCKER_ACTIONS_QUICK_REF.md
git add docs/DOCKER_ACTIONS_SETUP_CHECKLIST.md

git commit -m "feat: add enhanced Docker CI/CD workflows

- Consolidate Docker validation into ci-enhanced
- Add docker-image-scan with SBOM generation
- Add docker-multi-arch for ARM64 support
- Enhance ci-enhanced with health checks
- Enhance deploy with ECR direct push
- Add comprehensive documentation

Assisted-By: cagent"

git push origin main
```

### Step 2: Verify Initial Runs
- [ ] Check Actions tab for triggered workflows
- [ ] Verify `ci-enhanced.yml` passes with new health checks
- [ ] Confirm `deploy.yml` pushes to ECR successfully

### Step 3: Manual Workflow Triggers
```bash
# Run full CI manually
gh workflow run ci-enhanced.yml

# Initial security scan
gh workflow run docker-image-scan.yml
```

Wait 5-10 minutes, then verify:
- [ ] CI run completed successfully
- [ ] Security scan completed without failures

### Step 4: Configure Scheduled Workflows
Verify cron schedules are appropriate for your team:
- [ ] `docker-image-scan.yml` - Monday 6 AM UTC (weekly)

**Adjust if needed based on your team's timezone:**
```yaml
# Example: Change to 2 AM EST (7 AM UTC)
- cron: '0 7 * * *'
```

---

## ✅ Validation Tests

### Test 1: CI Pipeline Enhancement
1. Create a test branch: `git checkout -b test/docker-workflows`
2. Make a trivial change to a Dockerfile
3. Push and open PR
4. Verify:
   - [ ] `ci-enhanced.yml` runs docker-validate job
   - [ ] Health checks pass for all images
   - [ ] Image sizes displayed in logs

### Test 2: Deployment Flow
1. Merge PR to main
2. Verify `deploy.yml` runs:
   - [ ] ECR login succeeds
   - [ ] Image builds with cache
   - [ ] Image pushed to ECR with multiple tags
   - [ ] App Runner updated
   - [ ] Frontends deployed
   - [ ] Deployment summary shows image tags

### Test 3: Cache Effectiveness
1. Note build time from first CI run: _____ minutes
2. Wait for cache-warmup to complete
3. Make another trivial change and push
4. Note new build time: _____ minutes
5. Calculate improvement: _____ % faster
6. Expected: >50% improvement on cache hit

### Test 4: Security Scanning
1. Check GitHub Security tab
2. Verify:
   - [ ] Dockerfile lint results visible
   - [ ] No critical vulnerabilities (or known/accepted)
   - [ ] SBOM artifacts uploaded

---

## 🔧 Configuration Tuning

### Adjust Build Matrix Strategy
If you have limited Actions minutes, consider:

**Option 1: Sequential builds (slower but uses fewer resources)**
```yaml
strategy:
  matrix:
    service: [...]
  max-parallel: 1  # Build one at a time
```

**Option 2: Fail-fast (stop all on first failure)**
```yaml
strategy:
  fail-fast: true  # Default, change to false for our config
  matrix:
    service: [...]
```

### Adjust Cache Strategy
For very frequent builds, consider:
```yaml
cache-to: type=gha,mode=min  # Only cache final layers
```

For maximum speed, keep:
```yaml
cache-to: type=gha,mode=max  # Cache all stages (current)
```

### Adjust Security Scan Frequency
If scans are too frequent:
```yaml
on:
  schedule:
    - cron: '0 6 * * 1'  # Weekly (current)
    # Change to:
    - cron: '0 6 1 * *'  # Monthly (first Monday)
```

---

## 📊 Success Metrics

Track these after 1 week:

### Build Performance
- [ ] Average CI build time: Target <5 min with cache
- [ ] Average deployment time: Target <8 min total
- [ ] Cache hit rate: Target >80%

**How to measure:**
```bash
# Average build time last 10 runs
gh run list --workflow=ci-enhanced.yml --limit=10 --json duration

# Cache hit rate
# Check workflow logs for "cache hit" vs "cache miss"
```

### Security Posture
- [ ] Zero critical vulnerabilities
- [ ] <5 high-severity vulnerabilities
- [ ] All SBOMs generated successfully
- [ ] No secrets exposed in images

**How to check:**
- GitHub Security tab → Code scanning alerts
- Workflow runs → docker-image-scan → Summary

### Image Quality
- [ ] API image <500MB
- [ ] Frontend images <200MB each
- [ ] No Hadolint errors (warnings acceptable)

**How to check:**
- Workflow runs → docker-build-metrics → Summary

---

## 🚨 Troubleshooting

### Common Issues

#### Issue: "Resource not accessible by integration"
**Cause:** Insufficient permissions  
**Fix:**
```yaml
permissions:
  id-token: write
  contents: read
  security-events: write  # For SARIF uploads
```

#### Issue: ECR push fails with "denied: Your authorization token has expired"
**Cause:** OIDC role trust policy issue  
**Fix:** Verify trust policy includes:
```json
{
  "Effect": "Allow",
  "Principal": {
    "Federated": "arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com"
  },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
    },
    "StringLike": {
      "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/ClubOperationsPOS:*"
    }
  }
}
```

#### Issue: Cache not working
**Symptoms:** Builds always take full time  
**Fix:**
1. Check cache size: Settings → Actions → Caches
2. Verify cache keys match across jobs
3. Run cache-warmup manually
4. Check for pnpm-lock.yaml changes (invalidates cache)

#### Issue: Health checks timeout
**Symptoms:** "Container never reached healthy state"  
**Fix:**
1. Increase timeout in Dockerfile:
   ```dockerfile
   HEALTHCHECK --interval=30s --timeout=5s --start-period=30s
   ```
2. Check if app actually starts: `docker logs <container>`
3. Verify health endpoint works: `docker exec <container> wget -q -O- http://localhost/health`

#### Issue: SBOM generation fails
**Cause:** Anchore action version or image format issue  
**Fix:**
1. Update anchore/sbom-action to latest version
2. Ensure image is loaded (not just cached): `load: true` in build-push-action

---

## 📈 Optional Enhancements

### After workflows stabilize (2-4 weeks):

#### 1. Add Build Notifications
```yaml
- name: Notify on failure
  if: failure()
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: 'Docker build failed',
        body: 'Workflow run: ' + context.runId
      })
```

#### 2. Implement Image Promotion
Create `promote-to-prod.yml`:
```yaml
# Promote tested dev image to production
docker tag $ECR_URI:dev-abc1234 $ECR_URI:prod-latest
docker push $ECR_URI:prod-latest
```

#### 3. Add Drift Detection
```yaml
# Check if running image matches expected version
aws apprunner describe-service --service-arn $ARN \
  | jq -r '.Service.SourceConfiguration.ImageRepository.ImageIdentifier'
```

#### 4. Enable Multi-Arch by Default
If cost savings justify it:
```yaml
platforms: linux/amd64,linux/arm64  # Add to all builds
```

---

## 🎯 Rollout Plan

### Phase 1: Validation (Week 1)
- [ ] Deploy new workflows to main
- [ ] Monitor first few runs
- [ ] Fix any immediate issues
- [ ] Update team documentation

### Phase 2: Observation (Week 2-3)
- [ ] Collect build metrics
- [ ] Review security scan results
- [ ] Optimize cache hit rate
- [ ] Tune workflow schedules

### Phase 3: Optimization (Week 4+)
- [ ] Implement optional enhancements
- [ ] Consider multi-arch deployment
- [ ] Add custom alerts/notifications
- [ ] Document lessons learned

---

## 📞 Support

### Internal Resources
- Documentation: `docs/GITHUB_ACTIONS_DOCKER.md`
- Quick reference: `docs/DOCKER_ACTIONS_QUICK_REF.md`
- Docker guide: `DOCKER.md`

### External Resources
- GitHub Actions docs: https://docs.github.com/actions
- Docker Buildx docs: https://docs.docker.com/build/
- Hadolint rules: https://github.com/hadolint/hadolint

### Team Contacts
- CI/CD issues: [Team Lead]
- AWS/Infrastructure: [DevOps Lead]
- Security concerns: [Security Team]

---

## ✨ Success Indicators

After full deployment, you should see:

1. **Faster Builds**
   - CI runs complete in <5 minutes
   - Deployments take <8 minutes
   - Local development builds are faster

2. **Better Security**
   - Automated vulnerability scanning
   - SBOM available for compliance
   - Dockerfile best practices enforced

3. **Improved Observability**
   - Build time trends tracked
   - Image size monitoring
   - Security posture visible

4. **Team Confidence**
   - Faster feedback on PRs
   - Reliable deployments
   - Easy rollbacks with image tags

---

**Checklist completed on:** ___________  
**Completed by:** ___________  
**Issues encountered:** ___________  
**Next review date:** ___________

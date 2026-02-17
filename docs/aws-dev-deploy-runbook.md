# AWS Dev Deploy Runbook (Option B)

This runbook covers the **dev-only** AWS deployment for:

- API: App Runner
- Frontends: S3 + CloudFront
- CI/CD: GitHub Actions with OIDC

All resources are prefixed with `club-ops-dev-` and tagged with:
`Project=ClubOperationsPOS`, `Owner=JoshuaKessell`, `Environment=dev`.
The App Runner service name is `club-ops-api-dev` (intentional exception).

## One-time Setup

### 1) Terraform apply (local state)

From repo root:

```bash
cd infra/terraform
terraform init
terraform plan -out tfplan
terraform apply tfplan
```

Note: Terraform state is **local** for now. Do **not** commit `terraform.tfstate`. Plan a remote backend later.

Terraform now provisions a dev RDS Postgres instance and a VPC connector for App Runner.

### 2) Database credentials (RDS)

After apply, fetch the master user secret from Terraform output:

```bash
cd infra/terraform
terraform output db_master_secret_arn
```

Then retrieve the password from Secrets Manager (requires AWS CLI creds):

```bash
aws secretsmanager get-secret-value \
  --secret-id <secret-arn-from-output> \
  --query SecretString \
  --output text
```

The secret JSON includes `username` and `password`. Build a connection string:

```
postgresql://<username>:<password>@<db_endpoint>:<db_port>/<db_name>
```

Use Terraform outputs for `db_endpoint`, `db_port`, and `db_name`.

Create the app's DATABASE_URL secret (recommended):

```bash
aws secretsmanager create-secret \
  --name club-ops/dev/database-url \
  --secret-string "postgresql://<username>:<password>@<db_endpoint>:<db_port>/<db_name>?sslmode=require"
```

Create the kiosk token secret (recommended):

```bash
aws secretsmanager create-secret \
  --name club-ops/dev/kiosk-token \
  --secret-string "<kiosk-token>"
```

### 3) Cloudflare DNS (DNS-only, proxy OFF)

Terraform outputs the DNS validation records for ACM and App Runner.

Add these CNAME records in Cloudflare (DNS only, no proxy):

- ACM validation records from `acm_frontend_validation_records`
- App Runner validation records from `apprunner_custom_domain_validation_records`

After DNS is set, re-run:

```bash
cd infra/terraform
terraform apply
```

### 4) GitHub Actions secrets

Add these in GitHub repo settings → Secrets:

**AWS / IAM**

- `AWS_ROLE_ARN` = Terraform output `github_actions_role_arn`

**App Runner / API**

- `APP_RUNNER_SERVICE_ARN` = Terraform output `apprunner_service_arn`
- `ECR_REPO_URI` = `146469921099.dkr.ecr.us-east-1.amazonaws.com/club-ops-api`
- `DATABASE_URL_SECRET_ARN` = Terraform output `database_url_secret_arn`
- `KIOSK_TOKEN_SECRET_ARN` = Terraform output `kiosk_token_secret_arn`

**Important:** use literal secret names only (no alias/fallback names). The deploy scripts now fail fast if required names are missing.

Note: If you change the App Runner service name via `api_service_name`, Terraform will recreate the service.
After apply, update `APP_RUNNER_SERVICE_ARN` to the new value and re-run DNS validation if required.
Terraform also attaches an App Runner instance role that allows reading the Secrets Manager ARNs above.

**Frontends**

- `EMPLOYEE_BUCKET` = Terraform output `employee_bucket_name`
- `EMPLOYEE_DISTRIBUTION_ID` = Terraform output `employee_cloudfront_distribution_id`
- `CUSTOMER_BUCKET` = Terraform output `customer_bucket_name`
- `CUSTOMER_DISTRIBUTION_ID` = Terraform output `customer_cloudfront_distribution_id`
- `OFFICE_BUCKET` = Terraform output `office_bucket_name`
- `OFFICE_DISTRIBUTION_ID` = Terraform output `office_cloudfront_distribution_id`

## Day-to-Day Workflow

1. Create a feature branch and open PR to `main`.
2. CI runs automatically (lint + build + typecheck).
3. Merge to `main` triggers **deploy**:
   - API image build + push → App Runner update
   - Frontend build → S3 sync → CloudFront invalidation

You can also run a **frontends-only** deploy manually from GitHub Actions:
`Deploy (dev frontends only)` (workflow_dispatch).

## Where Variables Live

- **GitHub Secrets**: deploy-time values (`DATABASE_URL_SECRET_ARN`, `KIOSK_TOKEN_SECRET_ARN`)
- **App Runner runtime env**: set on deploy via `deploy-api.sh`
- **Vite build-time env**: `VITE_KIOSK_TOKEN` is fetched from `KIOSK_TOKEN_SECRET_ARN` inside deploy scripts/workflow

## Demo Data Seeding

The API already includes a **Busy Saturday** demo seed that covers the past 14 days and next 14 days,
including agreement signing PDFs.

To seed a fresh database:

- Set `DEMO_MODE=true`
- Set `SEED_ON_STARTUP=true` for the first deploy (forces a full rebuild)

For ongoing deploys:

- Keep `DEMO_MODE=true`
- Set `SEED_ON_STARTUP=false` to use the snapshot + timestamp shift (fast startup)
- Set `DEMO_INCREMENTAL=true` to append new visits between the last deploy and now

If you want to regenerate a brand‑new dataset each deploy, keep `SEED_ON_STARTUP=true`.

## Verification

API:

```bash
curl https://api-demo.joshuakessell.com/health
```

Expected: JSON with `status: ok` and current timestamp.

Employee register:

```bash
curl -I https://employee-demo.joshuakessell.com
```

Expected: HTTP 200 from CloudFront.

Customer kiosk:

```bash
curl -I https://customer-demo.joshuakessell.com
```

Expected: HTTP 200 from CloudFront.

Office dashboard:

```bash
curl -I https://office-demo.joshuakessell.com
```

Expected: HTTP 200 from CloudFront.

## Rollback

**API**

- Re-deploy a previous ECR tag:
  - Update the image tag in the deploy script or run:
    ```bash
    ECR_REPO_URI=146469921099.dkr.ecr.us-east-1.amazonaws.com/club-ops-api \
    APP_RUNNER_SERVICE_ARN=... \
    KIOSK_TOKEN_SECRET_ARN=... DATABASE_URL_SECRET_ARN=... \
    IMAGE_TAG=<previous-tag> \
    scripts/aws/deploy-api.sh
    ```

**Frontends**

- Rebuild from a previous commit and redeploy:
  ```bash
  git checkout <commit>
  scripts/aws/deploy-employee-kiosk.sh
  scripts/aws/deploy-customer-kiosk.sh
  ```

## Troubleshooting

- **App Runner logs**: AWS Console → App Runner → Service → Logs
- **CloudFront 403/404**: confirm OAC and bucket policy; ensure index.html exists
- **S3 sync errors**: verify bucket name + AWS permissions
- **OIDC assume role**: confirm GitHub repo in Terraform (`github_repo`) matches, role ARN secret set
- **DB SSL errors** (`self-signed certificate in certificate chain`): keep `DB_SSL=true` and leave `DB_SSL_CA_PATH` unset (or point it at the AWS RDS CA bundle), then redeploy the API

## Branch Protection Guidance

Enable branch protection on `main` in GitHub:

- Require status checks: CI + Lint
- Require PR reviews
- Require signed commits (optional)

(Do not enforce via automation.)

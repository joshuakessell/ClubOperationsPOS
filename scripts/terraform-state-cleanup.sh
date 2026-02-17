#!/bin/bash
# Safe state cleanup: removes all existing resources from Terraform tracking
# so that 'terraform apply' only creates the 5 new employee-kiosk resources.
# This does NOT delete any AWS resources — it only stops Terraform from managing them.

set -e
cd "$(dirname "$0")/../infra/terraform"

echo "Removing existing resources from Terraform state..."

resources=(
  aws_s3_bucket.customer
  aws_s3_bucket.employee
  aws_s3_bucket_ownership_controls.customer
  aws_s3_bucket_ownership_controls.employee
  aws_s3_bucket_policy.customer
  aws_s3_bucket_policy.employee
  aws_s3_bucket_public_access_block.customer
  aws_s3_bucket_public_access_block.employee
  aws_cloudfront_distribution.customer
  aws_cloudfront_distribution.employee
  aws_cloudfront_origin_access_control.frontend
  aws_acm_certificate.frontend
  aws_db_instance.db
  aws_db_subnet_group.db
  aws_security_group.apprunner
  aws_security_group.db
  aws_iam_openid_connect_provider.github
  aws_iam_policy.apprunner_appsync_events
  aws_iam_policy.apprunner_secrets
  aws_iam_policy.github_actions
  aws_iam_role.apprunner_ecr_access
  aws_iam_role.apprunner_instance
  aws_iam_role.github_actions
  aws_iam_role_policy_attachment.apprunner_appsync_events
  aws_iam_role_policy_attachment.apprunner_ecr_access
  aws_iam_role_policy_attachment.apprunner_secrets
  aws_iam_role_policy_attachment.github_actions
  aws_ecr_repository.api
  aws_apprunner_service.api
  aws_apprunner_vpc_connector.api
  aws_apprunner_custom_domain_association.api
  aws_secretsmanager_secret_version.database_url
)

for r in "${resources[@]}"; do
  echo "  Removing $r..."
  terraform state rm "$r" 2>/dev/null || echo "  (not in state, skipping)"
done

echo ""
echo "Done. Now run:"
echo "  cd infra/terraform"
echo "  terraform plan   # should show 5 to add, 0 to destroy"
echo "  terraform apply  # safe to apply"

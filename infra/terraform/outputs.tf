output "github_actions_role_arn" {
  value       = aws_iam_role.github_actions.arn
  description = "ARN of the GitHub Actions OIDC role"
}

output "apprunner_service_arn" {
  value       = aws_apprunner_service.api.arn
  description = "App Runner service ARN for the API"
}

output "apprunner_service_name" {
  value       = aws_apprunner_service.api.service_name
  description = "App Runner service name for the API"
}

output "apprunner_service_url" {
  value       = aws_apprunner_service.api.service_url
  description = "Default App Runner service URL"
}

output "database_url_secret_arn" {
  value       = var.database_url_secret_arn
  description = "Secrets Manager ARN for the DATABASE_URL secret"
}

output "kiosk_token_secret_arn" {
  value       = var.kiosk_token_secret_arn
  description = "Secrets Manager ARN for the kiosk token secret"
}

output "db_endpoint" {
  value       = aws_db_instance.db.address
  description = "RDS endpoint address"
}

output "db_port" {
  value       = aws_db_instance.db.port
  description = "RDS port"
}

output "db_name" {
  value       = aws_db_instance.db.db_name
  description = "RDS database name"
}

output "db_master_username" {
  value       = aws_db_instance.db.username
  description = "RDS master username"
}

output "db_master_secret_arn" {
  value       = aws_db_instance.db.master_user_secret[0].secret_arn
  description = "Secrets Manager ARN for the RDS master user"
}

output "apprunner_custom_domain_validation_records" {
  value       = aws_apprunner_custom_domain_association.api.certificate_validation_records
  description = "CNAME records required to validate the App Runner custom domain"
}

output "employee_bucket_name" {
  value       = aws_s3_bucket.employee.bucket
  description = "S3 bucket for employee register"
}

output "customer_bucket_name" {
  value       = aws_s3_bucket.customer.bucket
  description = "S3 bucket for customer kiosk"
}

output "office_bucket_name" {
  value       = var.office_bucket_name
  description = "S3 bucket for office dashboard"
}

output "employee_cloudfront_domain" {
  value       = aws_cloudfront_distribution.employee.domain_name
  description = "CloudFront domain for employee register"
}

output "customer_cloudfront_domain" {
  value       = aws_cloudfront_distribution.customer.domain_name
  description = "CloudFront domain for customer kiosk"
}

output "office_cloudfront_domain" {
  value       = data.aws_cloudfront_distribution.office.domain_name
  description = "CloudFront domain for office dashboard"
}

output "employee_cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.employee.id
  description = "CloudFront distribution ID for employee register"
}

output "customer_cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.customer.id
  description = "CloudFront distribution ID for customer kiosk"
}

output "office_cloudfront_distribution_id" {
  value       = data.aws_cloudfront_distribution.office.id
  description = "CloudFront distribution ID for office dashboard"
}

output "acm_frontend_validation_records" {
  value       = aws_acm_certificate.frontend.domain_validation_options
  description = "DNS records to add in Cloudflare to validate the frontend certificate"
}

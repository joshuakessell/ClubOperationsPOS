output "employee_kiosk_bucket_name" {
  description = "S3 bucket name — set as EMPLOYEE_BUCKET in GitHub repo variables"
  value       = aws_s3_bucket.employee_kiosk.bucket
}

output "employee_kiosk_distribution_id" {
  description = "CloudFront distribution ID — set as EMPLOYEE_DISTRIBUTION_ID in GitHub repo variables"
  value       = aws_cloudfront_distribution.employee_kiosk.id
}

output "employee_kiosk_distribution_domain" {
  description = "CloudFront domain name (use for DNS CNAME/alias if needed)"
  value       = aws_cloudfront_distribution.employee_kiosk.domain_name
}

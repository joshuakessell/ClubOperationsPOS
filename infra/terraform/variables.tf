variable "aws_region" {
  type        = string
  description = "AWS region for all dev resources"
  default     = "us-east-1"
}

variable "github_repo" {
  type        = string
  description = "GitHub repo in owner/name format for OIDC trust"
  default     = "joshuakessell/ClubOperationsPOS"
}

variable "github_oidc_thumbprint" {
  type        = string
  description = "GitHub Actions OIDC root CA thumbprint"
  default     = "6938fd4d98bab03faadb97b34396831e3780aea1"
}

variable "ecr_repo_url" {
  type        = string
  description = "ECR repo URL for the API image"
  default     = "146469921099.dkr.ecr.us-east-1.amazonaws.com/club-ops-api"
}

variable "api_domain" {
  type        = string
  description = "Custom domain for App Runner API"
  default     = "api-demo.joshuakessell.com"
}

variable "api_service_name" {
  type        = string
  description = "App Runner service name for the API"
  default     = "club-ops-api-dev"
}

variable "database_url_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for the DATABASE_URL secret"
  default     = "arn:aws:secretsmanager:us-east-1:146469921099:secret:club-ops/dev/database-url-an64dg"
}

variable "kiosk_token_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for the kiosk token secret"
  default     = "arn:aws:secretsmanager:us-east-1:146469921099:secret:club-ops/dev/kiosk-token-B9P3EM"
}

variable "db_identifier" {
  type        = string
  description = "RDS instance identifier"
  default     = "club-ops-dev-db"
}

variable "db_name" {
  type        = string
  description = "Database name to create in Postgres"
  default     = "club_operations"
}

variable "db_master_username" {
  type        = string
  description = "Master username for the RDS instance"
  default     = "clubops"
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance class for dev"
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type        = number
  description = "Allocated storage in GB"
  default     = 20
}

variable "apprunner_subnet_ids" {
  type        = list(string)
  description = "Optional list of subnet IDs to use for the App Runner VPC connector"
  default     = []
}

variable "apprunner_unsupported_az_ids" {
  type        = list(string)
  description = "Availability zone IDs that App Runner does not support for VPC connectors"
  default     = ["use1-az3"]
}

variable "employee_web_acl_arn" {
  type        = string
  description = "Web ACL ARN for the employee CloudFront distribution"
  default     = "arn:aws:wafv2:us-east-1:146469921099:global/webacl/CreatedByCloudFront-e76e6b4d/590ab5da-d6a6-4386-bc3e-f8d1e08c09d0"
}

variable "customer_web_acl_arn" {
  type        = string
  description = "Web ACL ARN for the customer CloudFront distribution"
  default     = "arn:aws:wafv2:us-east-1:146469921099:global/webacl/CreatedByCloudFront-1bea8086/3079b04f-bb64-48ef-be5d-3fce672335b5"
}

variable "employee_domain" {
  type        = string
  description = "Custom domain for employee register frontend"
  default     = "employee-demo.joshuakessell.com"
}

variable "customer_domain" {
  type        = string
  description = "Custom domain for customer kiosk frontend"
  default     = "customer-demo.joshuakessell.com"
}

variable "office_domain" {
  type        = string
  description = "Custom domain for office dashboard frontend"
  default     = "office-demo.joshuakessell.com"
}

variable "employee_bucket_name" {
  type        = string
  description = "S3 bucket name for employee register"
  default     = "club-ops-dev-employee-demo"
}

variable "customer_bucket_name" {
  type        = string
  description = "S3 bucket name for customer kiosk"
  default     = "club-ops-dev-customer-demo"
}

variable "office_bucket_name" {
  type        = string
  description = "S3 bucket name for office dashboard"
  default     = "club-ops-dev-office-demo"
}

variable "office_cloudfront_distribution_id" {
  type        = string
  description = "Existing CloudFront distribution ID for office dashboard"
  default     = "ECGX4F4QK8Q2B"
}

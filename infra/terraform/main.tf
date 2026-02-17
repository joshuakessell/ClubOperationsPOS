terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# --------------------------------------------------------------------------
# S3 bucket — static hosting for employee-kiosk frontend
# --------------------------------------------------------------------------

resource "aws_s3_bucket" "employee_kiosk" {
  bucket = "${var.project_name}-employee-kiosk"

  tags = {
    Project     = var.project_name
    Service     = "employee-kiosk"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_public_access_block" "employee_kiosk" {
  bucket = aws_s3_bucket.employee_kiosk.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "employee_kiosk" {
  bucket = aws_s3_bucket.employee_kiosk.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOAC"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.employee_kiosk.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.employee_kiosk.arn
          }
        }
      }
    ]
  })
}

# --------------------------------------------------------------------------
# IAM — GitHub Actions deploy role: S3 permissions for employee-kiosk
# --------------------------------------------------------------------------

data "aws_iam_role" "github_actions_deploy" {
  name = "${var.project_name}-${var.environment}-github-actions-deploy"
}

resource "aws_iam_role_policy" "github_actions_deploy_employee_kiosk" {
  name = "DeployEmployeeKiosk"
  role = data.aws_iam_role.github_actions_deploy.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ListEmployeeKioskBucket"
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.employee_kiosk.arn
      },
      {
        Sid    = "WriteEmployeeKioskBucket"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.employee_kiosk.arn}/*"
      },
      {
        Sid      = "InvalidateEmployeeKioskDistribution"
        Effect   = "Allow"
        Action   = "cloudfront:CreateInvalidation"
        Resource = aws_cloudfront_distribution.employee_kiosk.arn
      }
    ]
  })
}



# --------------------------------------------------------------------------
# CloudFront — CDN with SPA routing
# --------------------------------------------------------------------------

resource "aws_cloudfront_origin_access_control" "employee_kiosk" {
  name                              = "${var.project_name}-employee-kiosk-oac"
  description                       = "OAC for employee-kiosk S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "employee_kiosk" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name} employee-kiosk"
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # US, Canada, Europe

  origin {
    domain_name              = aws_s3_bucket.employee_kiosk.bucket_regional_domain_name
    origin_id                = "S3-employee-kiosk"
    origin_access_control_id = aws_cloudfront_origin_access_control.employee_kiosk.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-employee-kiosk"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  # SPA routing — serve index.html for 403/404 (missing keys)
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  # Immutable assets (hashed filenames) — long cache
  ordered_cache_behavior {
    path_pattern           = "/assets/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-employee-kiosk"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 31536000
    default_ttl = 31536000
    max_ttl     = 31536000
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Using custom domain certificate (see below)

  # --- Custom domain (uncomment if using employee-demo.joshuakessell.com) ---
  aliases = ["employee-demo.joshuakessell.com"]
  #
  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn  # must be in us-east-1
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Project     = var.project_name
    Service     = "employee-kiosk"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

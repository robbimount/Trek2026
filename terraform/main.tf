# ============================================================
# Random suffix for globally unique bucket name
# ============================================================

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# ============================================================
# S3 Bucket
# ============================================================

resource "aws_s3_bucket" "website" {
  bucket = "${var.bucket_name_prefix}-${random_id.bucket_suffix.hex}"
  tags   = var.common_tags
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "website" {
  bucket = aws_s3_bucket.website.id

  versioning_configuration {
    status = "Enabled"
  }
}

# ============================================================
# CloudFront Origin Access Control (OAC)
# ============================================================

resource "aws_cloudfront_origin_access_control" "website" {
  name                              = "${var.bucket_name_prefix}-oac"
  description                       = "OAC for Pioneer Trek 2026 website"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ============================================================
# CloudFront Distribution
# ============================================================

resource "aws_cloudfront_distribution" "website" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  comment             = "Pioneer Trek 2026 — Mount Saratoga Stake"
  aliases             = ["mountsaratogatrek2026.org", "www.mountsaratogatrek2026.org"]
  tags                = var.common_tags

  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.website.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.website.id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # S3 returns 403 (not 404) for missing objects when public access is blocked
  custom_error_response {
    error_code            = 403
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 60
  }

  custom_error_response {
    error_code            = 404
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 60
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = "arn:aws:acm:us-east-1:437005033727:certificate/ee038a6c-c08d-4be8-b7d1-1c135d0125db"
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

# ============================================================
# S3 Bucket Policy — allow CloudFront OAC only
# ============================================================

data "aws_iam_policy_document" "cloudfront_oac_access" {
  statement {
    sid    = "AllowCloudFrontOACGetObject"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.website.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.website.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id
  policy = data.aws_iam_policy_document.cloudfront_oac_access.json

  depends_on = [aws_s3_bucket_public_access_block.website]
}

# ============================================================
# S3 Objects — site files
# ============================================================

resource "aws_s3_object" "index_html" {
  bucket       = aws_s3_bucket.website.id
  key          = "index.html"
  source       = "${path.module}/../index.html"
  content_type = "text/html; charset=utf-8"
  etag         = filemd5("${path.module}/../index.html")
}

resource "aws_s3_object" "css_style" {
  bucket       = aws_s3_bucket.website.id
  key          = "css/style.css"
  source       = "${path.module}/../css/style.css"
  content_type = "text/css; charset=utf-8"
  etag         = filemd5("${path.module}/../css/style.css")
}

resource "aws_s3_object" "js_app" {
  bucket       = aws_s3_bucket.website.id
  key          = "js/app.js"
  source       = "${path.module}/../js/app.js"
  content_type = "application/javascript; charset=utf-8"
  etag         = filemd5("${path.module}/../js/app.js")
}

resource "aws_s3_object" "status_404_html" {
  bucket       = aws_s3_bucket.website.id
  key          = "404.html"
  source       = "${path.module}/../404.html"
  content_type = "text/html; charset=utf-8"
  etag         = filemd5("${path.module}/../404.html")
}

resource "aws_s3_object" "site_webmanifest" {
  bucket       = aws_s3_bucket.website.id
  key          = "site.webmanifest"
  source       = "${path.module}/../site.webmanifest"
  content_type = "application/manifest+json"
  etag         = filemd5("${path.module}/../site.webmanifest")
}

resource "aws_s3_object" "favicon_ico" {
  bucket       = aws_s3_bucket.website.id
  key          = "favicon.ico"
  source       = "${path.module}/../favicon.ico"
  content_type = "image/x-icon"
  etag         = filemd5("${path.module}/../favicon.ico")
}

resource "aws_s3_object" "icon_svg" {
  bucket       = aws_s3_bucket.website.id
  key          = "icon.svg"
  source       = "${path.module}/../icon.svg"
  content_type = "image/svg+xml"
  etag         = filemd5("${path.module}/../icon.svg")
}

resource "aws_s3_object" "icon_png" {
  bucket       = aws_s3_bucket.website.id
  key          = "icon.png"
  source       = "${path.module}/../icon.png"
  content_type = "image/png"
  etag         = filemd5("${path.module}/../icon.png")
}

resource "aws_s3_object" "img_activity_jpg" {
  bucket       = aws_s3_bucket.website.id
  key          = "img/activity.jpg"
  source       = "${path.module}/../img/activity.jpg"
  content_type = "image/jpeg"
  etag         = filemd5("${path.module}/../img/activity.jpg")
}

resource "aws_s3_object" "img_treklogo2_png" {
  bucket       = aws_s3_bucket.website.id
  key          = "img/treklogo2.png"
  source       = "${path.module}/../img/treklogo2.png"
  content_type = "image/png"
  etag         = filemd5("${path.module}/../img/treklogo2.png")
}

resource "aws_s3_object" "directory_html" {
  bucket       = aws_s3_bucket.website.id
  key          = "directory.html"
  source       = "${path.module}/../directory.html"
  content_type = "text/html; charset=utf-8"
  etag         = filemd5("${path.module}/../directory.html")
}

resource "aws_s3_object" "css_directory" {
  bucket       = aws_s3_bucket.website.id
  key          = "css/directory.css"
  source       = "${path.module}/../css/directory.css"
  content_type = "text/css; charset=utf-8"
  etag         = filemd5("${path.module}/../css/directory.css")
}

resource "aws_s3_object" "js_directory" {
  bucket       = aws_s3_bucket.website.id
  key          = "js/directory.js"
  source       = "${path.module}/../js/directory.js"
  content_type = "application/javascript; charset=utf-8"
  etag         = filemd5("${path.module}/../js/directory.js")
}

# NOTE: data/directory.json is intentionally NOT managed by Terraform.
# It is initially uploaded manually and thereafter updated exclusively by
# the admin Lambda (trek-save-directory). Managing it here would cause
# terraform apply to overwrite admin edits.

# ============================================================
# Lambda — save directory (admin persistence endpoint)
# ============================================================

data "archive_file" "save_directory_lambda" {
  type        = "zip"
  source_file = "${path.module}/../lambda/save_directory.py"
  output_path = "${path.module}/../lambda/save_directory.zip"
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "save_directory_lambda" {
  name               = "trek-save-directory-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = var.common_tags
}

data "aws_iam_policy_document" "save_directory_lambda_perms" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:*:*:*"]
  }
  statement {
    sid       = "S3ReadWrite"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.website.arn}/data/directory.json"]
  }
  statement {
    sid       = "CloudFrontInvalidate"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.website.arn]
  }
}

resource "aws_iam_role_policy" "save_directory_lambda" {
  name   = "save-directory-lambda-policy"
  role   = aws_iam_role.save_directory_lambda.id
  policy = data.aws_iam_policy_document.save_directory_lambda_perms.json
}

resource "aws_lambda_function" "save_directory" {
  function_name    = "trek-save-directory"
  role             = aws_iam_role.save_directory_lambda.arn
  handler          = "save_directory.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.save_directory_lambda.output_path
  source_code_hash = data.archive_file.save_directory_lambda.output_base64sha256

  environment {
    variables = {
      S3_BUCKET          = aws_s3_bucket.website.id
      S3_KEY             = "data/directory.json"
      CF_DISTRIBUTION_ID = aws_cloudfront_distribution.website.id
    }
  }

  tags = var.common_tags
}

# ============================================================
# API Gateway HTTP API (v2)
# ============================================================

resource "aws_apigatewayv2_api" "save_directory" {
  name          = "trek-save-directory-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["POST", "OPTIONS"]
    allow_headers = ["Content-Type"]
    max_age       = 300
  }

  tags = var.common_tags
}

resource "aws_apigatewayv2_integration" "save_directory" {
  api_id                 = aws_apigatewayv2_api.save_directory.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.save_directory.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "save_directory" {
  api_id    = aws_apigatewayv2_api.save_directory.id
  route_key = "POST /save"
  target    = "integrations/${aws_apigatewayv2_integration.save_directory.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.save_directory.id
  name        = "$default"
  auto_deploy = true
  tags        = var.common_tags
}

resource "aws_lambda_permission" "apigw_invoke_save_directory" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.save_directory.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.save_directory.execution_arn}/*/*"
}

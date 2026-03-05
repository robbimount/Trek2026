output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name — visit this URL after propagation (10–20 min)"
  value       = aws_cloudfront_distribution.website.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID — use this to create cache invalidations"
  value       = aws_cloudfront_distribution.website.id
}

output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.website.id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.website.arn
}

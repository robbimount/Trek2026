variable "bucket_name_prefix" {
  description = "Prefix for the S3 bucket name (a random hex suffix is appended for global uniqueness)"
  type        = string
  default     = "mount-saratoga-trek-2026"
}

variable "environment" {
  description = "Deployment environment (e.g. production, staging)"
  type        = string
  default     = "production"
}

variable "common_tags" {
  description = "Tags applied to all resources"
  type        = map(string)
  default = {
    Project     = "PioneerTrek2026"
    Stake       = "MountSaratogaStake"
    Environment = "production"
    ManagedBy   = "Terraform"
  }
}

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0" # Specify a recent version
    }
  }

  required_version = ">= 1.0"
}

provider "aws" {
  region = var.aws_region
  # Configure AWS credentials via environment variables, shared credentials file, or IAM roles.
  # Example:
  # access_key = var.aws_access_key
  # secret_key = var.aws_secret_key
}

# ------------------------------------------------------------------------------
# VARIABLES
# ------------------------------------------------------------------------------

variable "aws_region" {
  description = "The AWS region to deploy resources in."
  type        = string
  default     = "us-east-1" # Change to your preferred region
}

variable "vpc_cidr_block" {
  description = "The CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "project_name" {
  description = "A name prefix for resources."
  type        = string
  default     = "app"
}

variable "availability_zones" {
  description = "A list of Availability Zones to use."
  type        = list(string)
  # Note: Ensure these AZs are available in your selected region.
  # You can get a list of AZs for your region using: aws ec2 describe-availability-zones --region YOUR_REGION
  default = ["us-east-1a", "us-east-1b"] # Change to your preferred AZs
}

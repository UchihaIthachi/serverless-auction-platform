# This main.tf file is part of a Terraform project structured into multiple files.
#
# - provider.tf: Contains the AWS provider configuration and Terraform version requirements.
# - variables.tf: Defines all input variables for the project.
# - vpc.tf: Manages the creation of the AWS VPC and Internet Gateway.
# - subnets.tf: Defines public and private subnets across specified Availability Zones.
# - routing.tf: Configures route tables, NAT Gateway, and Elastic IP for network traffic.
# - security_groups.tf: Manages AWS Security Groups, including a dedicated one for Lambda functions.
# - endpoints.tf: Sets up VPC endpoints for services like S3, DynamoDB, SQS, CloudWatch Logs, and STS.
# - outputs.tf: Specifies the output values from the Terraform configuration (e.g., VPC ID, subnet IDs).
#
# Refer to the individual files for specific resource configurations.
# To apply this configuration, navigate to this directory in your terminal and run:
# 1. terraform init
# 2. terraform plan
# 3. terraform apply
#
# For detailed usage instructions, please see the project's README.md file (if available).

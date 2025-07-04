# ------------------------------------------------------------------------------
# SECURITY GROUPS
# ------------------------------------------------------------------------------

# Default Security Group - Modify to restrict inbound
resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.main.id

  # By default, the default SG allows all outbound traffic and all inbound traffic from within the SG itself.
  # It's good practice to remove all default inbound rules if not explicitly needed.
  # However, Terraform cannot delete the default rules entirely if they allow traffic from self.
  # Instead, we ensure no *other* inbound rules exist and rely on NACLs or more specific SGs.
  # For strict control, you might manage its rules explicitly or use a different SG for all resources.

  # To make it more restrictive (example: remove all inbound, keep default outbound):
  # ingress {
  #   description = "No inbound traffic allowed by default" # This won't actually create a rule
  #   from_port   = 0
  #   to_port     = 0
  #   protocol    = "-1" # All protocols
  #   cidr_blocks = ["127.0.0.1/32"] # Non-routable, effectively blocks external
  # }
  # Note: Modifying default SGs can be tricky and have wide implications.
  # For Lambdas, we will use a dedicated SG. It's often recommended not to rely on the default SG.

  tags = {
    Name        = "${var.project_name}-default-sg"
    Project     = var.project_name
    Environment = "dev"
  }
}

# Lambda Security Group
resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-lambda-sg"
  description = "Security group for Lambda functions"
  vpc_id      = aws_vpc.main.id

  # No inbound rules needed as Lambdas are invoked by AWS services or API Gateway, not direct network traffic.
  # If Lambda needs to be triggered by resources within the VPC (e.g. an EC2 instance calling Lambda via VPC endpoint),
  # you might add specific inbound rules from those resources' SGs.

  # Allow all outbound traffic.
  # This is necessary for Lambda to access AWS services (like S3, DynamoDB, SQS, CloudWatch Logs via NGW/Endpoints)
  # and any other internet resources if required (via NGW).
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1" # All protocols
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-lambda-sg"
    Project     = var.project_name
    Environment = "dev"
  }
}

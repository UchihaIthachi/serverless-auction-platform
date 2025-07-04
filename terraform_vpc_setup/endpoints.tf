# ------------------------------------------------------------------------------
# VPC ENDPOINTS
# ------------------------------------------------------------------------------

# S3 Gateway Endpoint
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id] # Associate with private route table

  tags = {
    Name        = "${var.project_name}-s3-vpce"
    Project     = var.project_name
    Environment = "dev"
  }
}

# DynamoDB Gateway Endpoint
resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id] # Associate with private route table

  tags = {
    Name        = "${var.project_name}-dynamodb-vpce"
    Project     = var.project_name
    Environment = "dev"
  }
}

# SQS Interface Endpoint
resource "aws_vpc_endpoint" "sqs" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.sqs"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true # Enable private DNS for the endpoint

  subnet_ids = [
    aws_subnet.private[0].id,
    aws_subnet.private[1].id,
  ]
  security_group_ids = [aws_security_group.lambda.id] # Allow Lambda SG to use this endpoint

  tags = {
    Name        = "${var.project_name}-sqs-vpce"
    Project     = var.project_name
    Environment = "dev"
  }
}

# CloudWatch Logs Interface Endpoint
resource "aws_vpc_endpoint" "logs" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.logs"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  subnet_ids = [
    aws_subnet.private[0].id,
    aws_subnet.private[1].id,
  ]
  security_group_ids = [aws_security_group.lambda.id]

  tags = {
    Name        = "${var.project_name}-logs-vpce"
    Project     = var.project_name
    Environment = "dev"
  }
}

# STS Interface Endpoint
resource "aws_vpc_endpoint" "sts" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.sts"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  subnet_ids = [
    aws_subnet.private[0].id,
    aws_subnet.private[1].id,
  ]
  security_group_ids = [aws_security_group.lambda.id]

  tags = {
    Name        = "${var.project_name}-sts-vpce"
    Project     = var.project_name
    Environment = "dev"
  }
}

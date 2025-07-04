# ------------------------------------------------------------------------------
# OUTPUTS
# ------------------------------------------------------------------------------

output "vpc_id" {
  description = "The ID of the VPC."
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "The IDs of the private subnets."
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "The IDs of the public subnets."
  value       = aws_subnet.public[*].id
}

output "lambda_security_group_id" {
  description = "The ID of the Lambda security group."
  value       = aws_security_group.lambda.id
}

output "nat_gateway_public_ip" {
  description = "The public IP address of the NAT Gateway."
  value       = aws_eip.nat.public_ip
}

output "availability_zones_used" {
  description = "The Availability Zones used for the subnets."
  value       = var.availability_zones
}

# ------------------------------------------------------------------------------
# ELASTIC IP & NAT GATEWAY (NGW)
# ------------------------------------------------------------------------------
# For production HA, consider a NAT Gateway in each AZ.
# For this example, one NGW is created for cost-effectiveness.

resource "aws_eip" "nat" {
  # domain = "vpc" # Use this for VPC EIPs, recommended. For older AWS provider versions, just `vpc = true`
  # Terraform AWS Provider v4.x and later uses `domain` argument
  # For provider v5.x, `domain` is still valid. If you encounter issues, check provider documentation.
  # If using an older provider without 'domain', you might need 'vpc = true' or it's implied.
  # For simplicity and broad compatibility, omitting `domain = "vpc"` for now,
  # as standard EIP works. If you need a "VPC EIP", uncomment and ensure provider supports it.
  tags = {
    Name        = "${var.project_name}-nat-eip"
    Project     = var.project_name
    Environment = "dev"
  }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id # Place NGW in the first public subnet

  tags = {
    Name        = "${var.project_name}-nat-gateway"
    Project     = var.project_name
    Environment = "dev"
  }

  # Ensure IGW is created before NGW that depends on public subnet connectivity
  depends_on = [aws_internet_gateway.main]
}

# ------------------------------------------------------------------------------
# ROUTE TABLES
# ------------------------------------------------------------------------------

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "${var.project_name}-public-rt"
    Project     = var.project_name
    Environment = "dev"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Private Route Table
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name        = "${var.project_name}-private-rt"
    Project     = var.project_name
    Environment = "dev"
  }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

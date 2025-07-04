# ------------------------------------------------------------------------------
# SUBNETS
# ------------------------------------------------------------------------------

# Public Subnets
resource "aws_subnet" "public" {
  count                   = 2 # One for each AZ
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr_block, 8, count.index + 1) # e.g., 10.0.1.0/24, 10.0.2.0/24
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true # Instances launched in public subnets get a public IP

  tags = {
    Name        = "${var.project_name}-public-subnet-${count.index + 1}"
    Project     = var.project_name
    Environment = "dev"
    Tier        = "Public"
  }
}

# Private Subnets
resource "aws_subnet" "private" {
  count             = 2 # One for each AZ
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr_block, 8, count.index + 3) # e.g., 10.0.3.0/24, 10.0.4.0/24
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "${var.project_name}-private-subnet-${count.index + 1}"
    Project     = var.project_name
    Environment = "dev"
    Tier        = "Private"
  }
}

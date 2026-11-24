locals {
  name = "sivale-${var.environment}"
}

data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = local.name }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.vpc_cidr, var.subnet_newbits, 0)
  map_public_ip_on_launch = true
  tags                    = { Name = "${local.name}-public" }
  lifecycle {
    precondition {
      condition     = tonumber(split("/", var.vpc_cidr)[1]) + var.subnet_newbits <= 28
      error_message = "A subnet deve ter prefixo IPv4 de no máximo /28."
    }
  }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = local.name }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = { Name = "${local.name}-public" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "backend" {
  name_prefix = "${local.name}-"
  description = "HTTP redirect/ACME and HTTPS only; administration through SSM"
  vpc_id      = aws_vpc.this.id
  tags        = { Name = local.name }
}

resource "aws_vpc_security_group_ingress_rule" "http" {
  for_each          = var.web_ingress_cidrs
  security_group_id = aws_security_group.backend.id
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  description       = "ACME validation and redirect to HTTPS"
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  for_each          = var.web_ingress_cidrs
  security_group_id = aws_security_group.backend.id
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  description       = "Backend HTTPS"
}

# Saída necessária para Aiven (porta própria), SSM, registries e APIs externas.
# Não representa permissão de entrada. Sem NAT Gateway ou endpoints pagos.
resource "aws_vpc_security_group_egress_rule" "outbound" {
  security_group_id = aws_security_group.backend.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
  description       = "External dependencies including Aiven and SSM"
}

resource "aws_iam_role" "backend" {
  name_prefix = "${local.name}-ec2-"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

# Equivalente à AmazonSSMManagedInstanceCore (v2), incluindo canais legados.
# As ações core usam Resource "*", como na política gerenciada da AWS.
resource "aws_iam_role_policy" "ssm" {
  name = "session-manager"
  role = aws_iam_role.backend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssm:DescribeAssociation",
        "ssm:GetDeployablePatchSnapshotForInstance",
        "ssm:GetDocument",
        "ssm:DescribeDocument",
        "ssm:GetManifest",
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:ListAssociations",
        "ssm:ListInstanceAssociations",
        "ssm:PutInventory",
        "ssm:PutComplianceItems",
        "ssm:PutConfigurePackageResult",
        "ssm:UpdateAssociationStatus",
        "ssm:UpdateInstanceAssociationStatus",
        "ssm:UpdateInstanceInformation",
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel",
        "ec2messages:AcknowledgeMessage",
        "ec2messages:DeleteMessage",
        "ec2messages:FailMessage",
        "ec2messages:GetEndpoint",
        "ec2messages:GetMessages",
        "ec2messages:SendReply",
      ]
      Resource = "*"
    }]
  })
}

resource "aws_iam_instance_profile" "backend" {
  name_prefix = "${local.name}-"
  role        = aws_iam_role.backend.name
}

resource "aws_instance" "backend" {
  ami                    = data.aws_ssm_parameter.al2023.value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.backend.id]
  iam_instance_profile   = aws_iam_instance_profile.backend.name
  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    backend_unit = file("${path.module}/deploy/sivale-backend.service")
    proxy_unit   = file("${path.module}/deploy/sivale-proxy.service")
    caddyfile    = file("${path.module}/deploy/Caddyfile")
  })
  user_data_replace_on_change = true

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }
  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size
    encrypted             = true
    delete_on_termination = true
  }
  credit_specification {
    cpu_credits = "standard"
  }
  tags = { Name = "${local.name}-backend" }
  depends_on = [
    aws_route_table_association.public,
    aws_iam_role_policy.ssm,
  ]
}

resource "aws_eip" "backend" {
  domain     = "vpc"
  instance   = aws_instance.backend.id
  tags       = { Name = "${local.name}-backend" }
  depends_on = [aws_internet_gateway.this]
}

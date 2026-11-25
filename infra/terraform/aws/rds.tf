
# Subnets privadas para o PostgreSQL
resource "aws_subnet" "rds_a" {
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.vpc_cidr, var.subnet_newbits, 1)
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = false

  tags = { Name = "${local.name}-rds-a" }
}

resource "aws_subnet" "rds_b" {
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.vpc_cidr, var.subnet_newbits, 2)
  availability_zone       = "us-east-1b"
  map_public_ip_on_launch = false

  tags = { Name = "${local.name}-rds-b" }
}

resource "aws_db_subnet_group" "sivale" {
  name = "${local.name}-rds"
  subnet_ids = [
    aws_subnet.rds_a.id,
    aws_subnet.rds_b.id
  ]

  tags = { Name = "${local.name}-rds" }
}

# Banco acessível somente pela EC2 do SIVALE
resource "aws_security_group" "rds" {
  name_prefix = "${local.name}-rds-"
  description = "PostgreSQL private access from SIVALE EC2"
  vpc_id      = aws_vpc.this.id

  tags = { Name = "${local.name}-rds" }
}

resource "aws_vpc_security_group_ingress_rule" "rds_postgres" {
  security_group_id            = aws_security_group.rds.id
  referenced_security_group_id = aws_security_group.backend.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "PostgreSQL from SIVALE backend only"
}

resource "aws_db_instance" "sivale" {
  identifier = "${local.name}-postgres"

  engine         = "postgres"
  instance_class = "db.t4g.micro"

  allocated_storage = 20
  storage_type      = "gp2"
  storage_encrypted = true

  db_name  = "sivale"
  username = "sivaleadmin"

  # AWS gera e gerencia a senha
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.sivale.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  publicly_accessible = false
  multi_az            = false

  backup_retention_period  = 0
  deletion_protection      = false
  skip_final_snapshot      = true
  delete_automated_backups = true

  tags = { Name = "${local.name}-postgres" }
}
# Permite que a EC2 leia somente a credencial do RDS SIVALE
resource "aws_iam_role_policy" "rds_secret" {
  name = "read-sivale-rds-secret"
  role = aws_iam_role.backend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:DescribeSecret",
        "secretsmanager:GetSecretValue"
      ]
      Resource = aws_db_instance.sivale.master_user_secret[0].secret_arn
    }]
  })
}
variable "aws_region" {
  type        = string
  description = "Região AWS de implantação."
  default     = "sa-east-1"
}

variable "environment" {
  type        = string
  description = "Ambiente usado nos nomes e tags."
  default     = "staging"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{0,19}$", var.environment))
    error_message = "Use até 20 caracteres: letras minúsculas, números e hífens."
  }
}

variable "instance_type" {
  type        = string
  description = "Instância x86_64, compatível com a AMI e a imagem Docker linux/amd64."
  default     = "t3.small"
  validation {
    condition     = contains(["t3.micro", "t3.small", "t3.medium", "t3a.micro", "t3a.small", "t3a.medium"], var.instance_type)
    error_message = "Use um dos tamanhos x86_64 t3/t3a micro, small ou medium."
  }
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR IPv4 da VPC dedicada."
  default     = "10.42.0.0/16"
  validation {
    condition     = can(cidrnetmask(var.vpc_cidr)) && can(regex("/(1[6-9]|2[0-8])$", var.vpc_cidr))
    error_message = "Informe um CIDR IPv4 válido com prefixo entre /16 e /28."
  }
}

variable "subnet_newbits" {
  type        = number
  description = "Bits adicionais para a primeira subnet, derivada do CIDR da VPC."
  default     = 8
  validation {
    condition     = var.subnet_newbits >= 0 && floor(var.subnet_newbits) == var.subnet_newbits
    error_message = "Informe um inteiro não negativo que produza uma subnet AWS válida."
  }
}

variable "web_ingress_cidrs" {
  type        = set(string)
  description = "Clientes autorizados em TCP 80/443; acesso público necessário para frontend e ACME público."
  default     = ["0.0.0.0/0"]
  validation {
    condition     = alltrue([for cidr in var.web_ingress_cidrs : can(cidrnetmask(cidr))])
    error_message = "Informe apenas CIDRs IPv4 válidos."
  }
}

variable "root_volume_size" {
  type        = number
  description = "Disco gp3 criptografado, em GiB."
  default     = 20
  validation {
    condition     = var.root_volume_size >= 20 && var.root_volume_size <= 100 && floor(var.root_volume_size) == var.root_volume_size
    error_message = "Informe um inteiro entre 20 e 100 GiB."
  }
}

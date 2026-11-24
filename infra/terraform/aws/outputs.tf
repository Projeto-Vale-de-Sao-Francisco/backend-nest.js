output "instance_id" {
  description = "ID da EC2 para administração via Session Manager."
  value       = aws_instance.backend.id
}

output "public_ip" {
  description = "Elastic IP: destino do registro DNS A do backend."
  value       = aws_eip.backend.public_ip
}

output "vpc_id" {
  value = aws_vpc.this.id
}

output "security_group_id" {
  value = aws_security_group.backend.id
}

output "session_manager_command" {
  description = "Requer AWS CLI, plugin Session Manager e permissões do operador."
  value       = "aws ssm start-session --region ${var.aws_region} --target ${aws_instance.backend.id}"
}

import { usuarioAtual } from "./api";

export const ROTULO_PERFIL: Record<string, string> = {
  ADMIN: "Administrador",
  COMUM: "Usuário",
};

// 1a entrega: so o Administrador cadastra, edita e inativa; os demais perfis consultam e tratam alertas.
// Na 2a entrega (RBAC), separar Tecnico e Agricultor significa ajustar so este arquivo e a lista de permissoes da API.
export const ehAdmin = () => usuarioAtual()?.perfil === "ADMIN";
export const rotuloPerfil = (perfil?: string) => (perfil ? ROTULO_PERFIL[perfil] ?? perfil : "");

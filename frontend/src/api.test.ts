import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, salvarSessao } from "./api";

describe("cliente HTTP", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("envia o token ao revogar a sessão no backend", async () => {
    salvarSessao("token-de-teste", { id: 1, perfil: "ADMIN" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    await api.logout();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://chico-talhao-backend.onrender.com/auth/logout",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer token-de-teste" }) }),
    );
  });

  it("adapta a resposta de login do Chico Talhão para a sessão do frontend", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ accessToken: "jwt", user: { id: 7, nome: "Ana", email: "ana@example.com", tipo: "ADMIN" } }),
    );

    await expect(api.login("ana@example.com", "senha-segura")).resolves.toEqual({
      token: "jwt",
      usuario: { id: 7, nomeCompleto: "Ana", email: "ana@example.com", perfil: "ADMIN" },
    });
  });

  it("consulta lotes e normaliza relações aninhadas", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([{ id: 3, nome: "Lote Norte", propriedade_id: 2, area: 12, situacao: "ATIVO", propriedade: { id: 2, nome: "Fazenda Sol" }, culturas: [{ cultura: { id: 4, nome: "Uva" }, data_plantio: "2026-01-01", previsao_colheita: "2026-05-01", status: "ATIVA" }] }]),
    );

    const lotes = await api.talhoes();

    expect(fetchMock.mock.calls[0][0]).toBe("https://chico-talhao-backend.onrender.com/lotes");
    expect(lotes[0]).toMatchObject({ id: 3, propriedadeId: 2, culturaId: 4, cultura: { id: 4, nome: "Uva" }, dataPlantio: "2026-01-01", previsaoColheita: "2026-05-01" });
  });

  it("deriva propriedades das relações dos lotes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        { id: 1, propriedade: { id: 8, nome: "Fazenda Azul", municipio: "Petrolina" } },
        { id: 2, propriedade: { id: 8, nome: "Fazenda Azul", municipio: "Petrolina" } },
      ]),
    );

    await expect(api.propriedades()).resolves.toEqual([{ id: 8, nome: "Fazenda Azul", municipio: "Petrolina" }]);
  });

  it("usa os nomes de consulta do dashboard e extrai a lista paginada", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: [{ id: 1 }], meta: { total: 1 } }));

    await expect(api.dashboardHistorico({ talhaoId: 5, dataInicio: "2026-01-01" })).resolves.toEqual([{ id: 1 }]);
    expect(fetchMock.mock.calls[0][0]).toContain("/dashboard/historico?talhao_id=5&data_inicio=2026-01-01");
  });

  it("combina mensagens de validação do NestJS", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: ["campo obrigatório", "valor inválido"] }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(api.login("x@example.com", "senha")).rejects.toThrow("campo obrigatório · valor inválido");
  });

  it("produz mensagem estável quando o erro não contém JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("indisponível", { status: 503 }));
    await expect(api.me()).rejects.toThrow("Erro na requisição.");
  });
});

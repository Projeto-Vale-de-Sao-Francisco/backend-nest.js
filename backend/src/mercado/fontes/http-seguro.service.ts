import { Injectable } from '@nestjs/common';

const MAX_BYTES = 5 * 1024 * 1024;
export class ErroFonte extends Error {
  constructor(
    message: string,
    readonly repetir = false,
    readonly tentarApos?: number,
  ) {
    super(message);
  }
}
export function mensagemFonte(error: unknown): string {
  return error instanceof ErroFonte
    ? error.message
    : 'Não foi possível consultar ou armazenar os dados da fonte';
}

@Injectable()
export class HttpSeguroService {
  private readonly bloqueios = new Map<string, number>();
  async json(
    url: string,
    init: RequestInit,
    hosts: readonly string[],
    timeoutMs: number,
  ): Promise<unknown> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) timeoutMs = 10000;
    const destino = new URL(url);
    if (
      destino.protocol !== 'https:' ||
      destino.username ||
      destino.password ||
      !hosts.includes(destino.host)
    )
      throw new ErroFonte('Host externo não permitido');
    const bloqueadoAte = this.bloqueios.get(destino.host) ?? 0;
    if (bloqueadoAte > Date.now())
      throw new ErroFonte(
        'Fonte temporariamente limitada; aguarde Retry-After',
        false,
        bloqueadoAte,
      );
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let falha: ErroFonte | undefined;
      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
          redirect: 'manual',
        });
        if (response.status === 429) {
          const raw = response.headers.get('retry-after');
          const segundos = raw && /^\d+$/.test(raw) ? Number(raw) : null;
          const ate =
            segundos !== null
              ? Date.now() + segundos * 1000
              : raw
                ? Date.parse(raw)
                : NaN;
          const tentarApos =
            Number.isFinite(ate) && ate > Date.now()
              ? ate
              : Date.now() + 60_000;
          this.bloqueios.set(destino.host, tentarApos);
          throw new ErroFonte(
            'Fonte temporariamente limitada; aguarde Retry-After',
            false,
            tentarApos,
          );
        }
        if (response.status >= 300 && response.status < 400)
          throw new ErroFonte('Redirecionamento externo não permitido');
        if (!response.ok)
          throw new ErroFonte(
            `Fonte respondeu HTTP ${response.status}`,
            response.status >= 500,
          );
        if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES)
          throw new ErroFonte('Resposta externa excede 5 MB');
        const reader = response.body?.getReader();
        if (!reader) throw new ErroFonte('Resposta externa vazia');
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > MAX_BYTES)
              throw new ErroFonte('Resposta externa excede 5 MB');
            chunks.push(value);
          }
        } finally {
          await reader.cancel().catch(() => undefined);
        }
        try {
          return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
        } catch {
          throw new ErroFonte('Resposta externa contém JSON inválido');
        }
      } catch (error) {
        falha =
          error instanceof ErroFonte
            ? error
            : new ErroFonte(
                controller.signal.aborted
                  ? 'Tempo limite da fonte excedido'
                  : 'Falha de rede ao consultar a fonte',
                true,
              );
      } finally {
        clearTimeout(timer);
      }
      if (!falha?.repetir || tentativa === 1) throw falha;
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
    }
    throw new ErroFonte('Falha ao consultar a fonte');
  }
}

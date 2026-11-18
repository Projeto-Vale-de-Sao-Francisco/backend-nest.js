import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { ExecutePipelineDto, PipelineSource } from './dto/execute-pipeline.dto.js';

export type PipelineQualityStatus =
  | 'valid'
  | 'corrected'
  | 'filled'
  | 'suspect'
  | 'invalid'
  | 'discarded';

export interface PipelineRecord {
  source?: PipelineSource;
  id?: string | number | null;
  sensorId?: number | string | null;
  variable?: string | null;
  value?: number | string | null;
  unit?: string | null;
  timestamp?: string | Date | null;
  currency?: string | null;
  market?: string | null;
  crop?: string | null;
  location?: string | null;
  originalValue?: number | string | null;
  reason?: string | null;
  status?: PipelineQualityStatus;
  normalizedValue?: number | string | null;
  normalizedTimestamp?: string | null;
  sourceType?: string;
  conversionRate?: number | null;
  convertedValue?: number | null;
  [key: string]: unknown;
}

export interface PipelineExecutionSummary {
  executionId: number;
  status: 'success' | 'error';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totalReceived: number;
  totalProcessed: number;
  totalValid: number;
  totalCorrected: number;
  totalFilled: number;
  totalDuplicatesRemoved: number;
  totalInvalid: number;
  totalOutliers: number;
  totalDiscarded: number;
  records: PipelineRecord[];
  problems: Array<{
    source: string;
    type: string;
    quantity: number;
    reason: string;
  }>;
}

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async execute(
    dto: ExecutePipelineDto = {},
    usuarioId?: number,
    ipOrigem?: string,
  ) {
    const startedAt = new Date();
    const source = dto.source ?? 'manual';
    const records = (dto.records ?? []) as PipelineRecord[];

    const execution = await this.prisma.$transaction(async (tx) => {
      const created = await tx.pipeline_Execucao.create({
        data: {
          source,
          status: 'processando',
          started_at: startedAt,
          total_received: records.length,
          total_processed: 0,
          total_valid: 0,
          total_corrected: 0,
          total_filled: 0,
          total_duplicates_removed: 0,
          total_invalid: 0,
          total_outliers: 0,
          total_discarded: 0,
        },
      });
      await this.audit.record(
        {
          usuarioId,
          acao: 'EXECUTAR',
          recurso: 'PIPELINE',
          recursoId: created.id,
          ipOrigem,
        },
        tx,
      );
      return created;
    });

    try {
      const results = this.processRecords(records);

      await this.prisma.pipeline_Execucao.update({
        where: { id: execution.id },
        data: {
          status: 'concluido',
          finished_at: new Date(),
          duration_ms: Date.now() - startedAt.getTime(),
          total_received: results.totalReceived,
          total_processed: results.totalProcessed,
          total_valid: results.totalValid,
          total_corrected: results.totalCorrected,
          total_filled: results.totalFilled,
          total_duplicates_removed: results.totalDuplicatesRemoved,
          total_invalid: results.totalInvalid,
          total_outliers: results.totalOutliers,
          total_discarded: results.totalDiscarded,
          summary_json: JSON.stringify({
            problems: results.problems,
            records: results.records,
          }),
        },
      });

      if (results.problems.length > 0) {
        await this.prisma.pipeline_Problema.createMany({
          data: results.problems.map((problem) => ({
            execution_id: execution.id,
            source: problem.source,
            tipo_dado: problem.type,
            tipo_problema: 'tratamento',
            quantidade: problem.quantity,
            motivo: problem.reason,
          })),
        });
      }

      return {
        executionId: execution.id,
        status: 'success',
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        totalReceived: results.totalReceived,
        totalProcessed: results.totalProcessed,
        totalValid: results.totalValid,
        totalCorrected: results.totalCorrected,
        totalFilled: results.totalFilled,
        totalDuplicatesRemoved: results.totalDuplicatesRemoved,
        totalInvalid: results.totalInvalid,
        totalOutliers: results.totalOutliers,
        totalDiscarded: results.totalDiscarded,
        records: results.records,
        problems: results.problems,
      } satisfies PipelineExecutionSummary;
    } catch (error) {
      const finishedAt = new Date();
      this.logger.error(
        'Pipeline falhou',
        error instanceof Error ? error.stack : undefined,
      );
      await this.prisma.pipeline_Execucao.update({
        where: { id: execution.id },
        data: {
          status: 'falhou',
          finished_at: finishedAt,
          duration_ms: finishedAt.getTime() - startedAt.getTime(),
          summary_json: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      });

      throw error;
    }
  }

  async executeAutomatic(records: PipelineRecord[] = [], source: PipelineSource = 'sensor') {
    return this.execute({ source, records: records as any, force: true } as ExecutePipelineDto);
  }

  async getHistory(source?: string) {
    const where = source ? { source } : undefined;
    return this.prisma.pipeline_Execucao.findMany({
      where,
      orderBy: { started_at: 'desc' },
      include: { problemas: true },
    });
  }

  async getExecution(id: number) {
    const execution = await this.prisma.pipeline_Execucao.findUnique({
      where: { id },
      include: { problemas: true },
    });

    if (!execution) {
      throw new NotFoundException(`Execução de pipeline ${id} não encontrada.`);
    }

    return execution;
  }

  async getExecutionReport(id: number) {
    const execution = await this.getExecution(id);
    return {
      ...execution,
      summary: execution.summary_json ? JSON.parse(String(execution.summary_json)) : null,
    };
  }

  processRecords(records: PipelineRecord[] = []): PipelineExecutionSummary {
    const normalized = records.map((record) => this.normalizeRecord(record));
    const withInterpolation = this.fillMissingValues(normalized);
    const deduplicated = this.removeDuplicates(withInterpolation);
    const duplicateCount = withInterpolation.length - deduplicated.length;
    const processed = deduplicated.map((record) => this.applyDataQualityRules(record));
    const metrics = this.buildMetrics(processed, duplicateCount);

    return {
      executionId: 0,
      status: 'success',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      totalReceived: records.length,
      totalProcessed: processed.length,
      totalValid: metrics.totalValid,
      totalCorrected: metrics.totalCorrected,
      totalFilled: metrics.totalFilled,
      totalDuplicatesRemoved: duplicateCount,
      totalInvalid: metrics.totalInvalid,
      totalOutliers: metrics.totalOutliers,
      totalDiscarded: metrics.totalDiscarded,
      records: processed,
      problems: metrics.problems,
    };
  }

  normalizeRecord(record: PipelineRecord): PipelineRecord {
    const source = (record.source ?? 'manual') as PipelineSource;
    const clone = { ...record } as PipelineRecord;
    if (clone.value !== undefined && clone.value !== null && clone.value !== '') {
      const numeric = Number(clone.value);
      clone.value = Number.isFinite(numeric) ? numeric : clone.value;
    }
    if (clone.timestamp) {
      clone.normalizedTimestamp = normalizeDate(clone.timestamp, source);
    }
    if (clone.currency) {
      clone.currency = normalizeCurrency(clone.currency);
    }
    if (
      clone.value !== null &&
      clone.value !== undefined &&
      clone.value !== '' &&
      typeof clone.value === 'number' &&
      clone.conversionRate !== undefined &&
      clone.conversionRate !== null &&
      clone.currency
    ) {
      clone.convertedValue = convertCurrencyValue(
        Number(clone.value),
        clone.currency,
        clone.currency === 'USD' ? 'BRL' : 'USD',
        clone.conversionRate,
      );
    }
    return clone;
  }

  removeDuplicates(records: PipelineRecord[]): PipelineRecord[] {
    if (records.length === 0) {
      return [];
    }

    const seen = new Map<string, PipelineRecord>();

    for (const record of records) {
      const key = buildDuplicateKey(record);
      if (!key) {
        const fallbackKey = `fallback-${seen.size}-${Math.random()}`;
        seen.set(fallbackKey, record);
        continue;
      }

      const existing = seen.get(key);
      if (existing) {
        seen.set(key, choosePreferredRecord(existing, record));
      } else {
        seen.set(key, record);
      }
    }

    return Array.from(seen.values());
  }

  applyDataQualityRules(record: PipelineRecord): PipelineRecord {
    const working = { ...record };

    if (working.status === 'filled') {
      return {
        ...working,
        status: 'filled',
        normalizedValue: Number(working.value),
      };
    }

    if (working.source === 'sensor' && (!working.sensorId && !working.id)) {
      return {
        ...working,
        status: 'discarded',
        reason: 'Campo obrigatório de identificação ausente',
      };
    }

    if (working.timestamp && !working.normalizedTimestamp) {
      return {
        ...working,
        status: 'invalid',
        reason: 'Data inválida ou sem timezone confiável',
      };
    }

    if (working.value === null || working.value === undefined || working.value === '') {
      const filled = attemptInterpolation(working);
      if (filled !== null && filled !== undefined) {
        return {
          ...working,
          status: 'filled',
          reason: 'Valor preenchido por interpolação temporal',
          normalizedValue: filled,
          value: filled,
        };
      }
      return {
        ...working,
        status: 'discarded',
        reason: 'Valor ausente sem histórico suficiente',
      };
    }

    const numeric = Number(working.value);
    if (!Number.isFinite(numeric)) {
      return {
        ...working,
        status: 'invalid',
        reason: 'Valor incompatível com o tipo numérico esperado',
      };
    }

    if (isPhysicallyInvalid(working, numeric)) {
      return {
        ...working,
        status: 'invalid',
        reason: 'Valor fora do limite físico ou operacional',
      };
    }

    if (isOutlierRecord(working, numeric)) {
      return {
        ...working,
        status: 'suspect',
        reason: 'Registro identificado como valor extremo',
        normalizedValue: numeric,
      };
    }

    return {
      ...working,
      status: 'valid',
      normalizedValue: numeric,
      value: numeric,
    };
  }

  fillMissingValues(records: PipelineRecord[]) {
    const grouped = new Map<string, PipelineRecord[]>();
    for (const record of records) {
      const key = `${record.source ?? 'manual'}:${record.sensorId ?? record.id ?? 'unknown'}:${record.variable ?? 'valor'}`;
      const group = grouped.get(key) ?? [];
      group.push(record);
      grouped.set(key, group);
    }

    const result: PipelineRecord[] = [];
    for (const group of grouped.values()) {
      const sorted = [...group].sort((a, b) => {
        const left = a.normalizedTimestamp ? new Date(a.normalizedTimestamp).getTime() : Number.MAX_SAFE_INTEGER;
        const right = b.normalizedTimestamp ? new Date(b.normalizedTimestamp).getTime() : Number.MAX_SAFE_INTEGER;
        return left - right;
      });

      for (let index = 0; index < sorted.length; index += 1) {
        const record = sorted[index];
        if (record.value !== null && record.value !== undefined && record.value !== '') {
          result.push(record);
          continue;
        }

        const prev = [...sorted].slice(0, index).reverse().find((entry) => entry.value !== null && entry.value !== undefined && entry.value !== '');
        const next = sorted.slice(index + 1).find((entry) => entry.value !== null && entry.value !== undefined && entry.value !== '');

        if (prev && next) {
          const prevDate = prev.normalizedTimestamp ? new Date(prev.normalizedTimestamp).getTime() : 0;
          const nextDate = next.normalizedTimestamp ? new Date(next.normalizedTimestamp).getTime() : 0;
          const gap = Math.abs(nextDate - prevDate);
          if (gap <= 6 * 60 * 60 * 1000) {
            const prevValue = Number(prev.value);
            const nextValue = Number(next.value);
            const ratio = (nextDate - prevDate) === 0 ? 0 : (new Date(record.normalizedTimestamp ?? new Date()).getTime() - prevDate) / (nextDate - prevDate);
            const interpolated = prevValue + (nextValue - prevValue) * ratio;
            result.push({
              ...record,
              value: interpolated,
              normalizedValue: interpolated,
              status: 'filled',
              reason: 'Valor preenchido por interpolação temporal',
            });
            continue;
          }
        }

        result.push(record);
      }
    }

    return result;
  }

  buildMetrics(records: PipelineRecord[], duplicateCount = 0) {
    const problems: Array<{ source: string; type: string; quantity: number; reason: string }> = [];
    const statusMap: Record<string, number> = {
      valid: 0,
      corrected: 0,
      filled: 0,
      invalid: 0,
      outliers: 0,
      discarded: 0,
    };

    for (const record of records) {
      switch (record.status) {
        case 'valid':
          statusMap.valid += 1;
          break;
        case 'corrected':
          statusMap.corrected += 1;
          break;
        case 'filled':
          statusMap.filled += 1;
          break;
        case 'invalid':
          statusMap.invalid += 1;
          break;
        case 'suspect':
          statusMap.outliers += 1;
          break;
        case 'discarded':
          statusMap.discarded += 1;
          break;
      }
    }

    const sourceMap = new Map<string, number>();
    for (const record of records) {
      const source = String(record.source ?? 'manual');
      sourceMap.set(source, (sourceMap.get(source) ?? 0) + 1);
    }

    for (const [source, quantity] of sourceMap.entries()) {
      problems.push({
        source,
        type: 'fonte',
        quantity,
        reason: 'Total de registros processados por fonte',
      });
    }

    return {
      totalProcessed: records.length,
      totalValid: statusMap.valid,
      totalCorrected: statusMap.corrected,
      totalFilled: statusMap.filled,
      totalDuplicatesRemoved: duplicateCount,
      totalInvalid: statusMap.invalid,
      totalOutliers: statusMap.outliers,
      totalDiscarded: statusMap.discarded,
      problems,
    };
  }
}

function normalizeCurrency(currency: string | null | undefined) {
  return (currency ?? '').trim().toUpperCase() || 'BRL';
}

function convertCurrencyValue(
  value: number,
  fromCurrency: string,
  toCurrency: string,
  rate?: number | null,
) {
  if (!Number.isFinite(value) || !rate || rate <= 0) {
    return null;
  }
  if (fromCurrency === toCurrency) {
    return value;
  }
  return value * rate;
}

function normalizeDate(value: string | Date, source: PipelineSource) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (!/Z|[+-]\d{2}:?\d{2}$/.test(String(value))) {
    const offsetDate = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    return offsetDate.toISOString();
  }

  return date.toISOString();
}

function buildDuplicateKey(record: PipelineRecord) {
  const source = record.source ?? 'manual';
  const sensorId = record.sensorId ?? record.id;
  const variable = record.variable ?? 'valor';
  const ts = record.normalizedTimestamp ?? normalizeDate(record.timestamp ?? new Date(), source as PipelineSource);
  if (!sensorId && !(record.market || record.crop)) {
    return null;
  }

  if (record.market || record.crop) {
    return [source, record.market ?? 'mercado', record.crop ?? 'sem-cultura', record.currency ?? 'BRL', ts].join('|');
  }

  return [source, sensorId, variable, ts].join('|');
}

function choosePreferredRecord(a: PipelineRecord, b: PipelineRecord) {
  const aScore = Number(Object.keys(a).length) + Number(a.normalizedValue ?? 0);
  const bScore = Number(Object.keys(b).length) + Number(b.normalizedValue ?? 0);
  return aScore >= bScore ? a : b;
}

function attemptInterpolation(record: PipelineRecord) {
  if (record.value !== null && record.value !== undefined && record.value !== '') {
    return record.value;
  }
  return null;
}

function isPhysicallyInvalid(record: PipelineRecord, value: number) {
  const variable = String(record.variable ?? '').toLowerCase();
  if (variable.includes('temperatura')) {
    return value < -50 || value > 65;
  }
  if (variable.includes('umidade')) {
    return value < 0 || value > 100;
  }
  if (variable.includes('precipit')) {
    return value < 0;
  }
  if (variable.includes('preco') || variable.includes('cambio')) {
    return value < 0;
  }
  return false;
}

function isOutlierRecord(record: PipelineRecord, value: number) {
  const variable = String(record.variable ?? '').toLowerCase();
  if (!variable) {
    return false;
  }
  return ['temperatura', 'umidade', 'precipitacao'].some((item) => variable.includes(item)) && Math.abs(value) > 100;
}

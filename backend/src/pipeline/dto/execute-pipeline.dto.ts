import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export const PIPELINE_SOURCES = [
  'sensor',
  'climatico',
  'mercado',
  'cambio',
  'manual',
] as const;

export type PipelineSource = (typeof PIPELINE_SOURCES)[number];

export class PipelineRecordDto {
  @IsOptional()
  @IsString()
  source?: PipelineSource;

  @IsOptional()
  @IsString()
  variable?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  market?: string;

  @IsOptional()
  @IsString()
  crop?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  sensorId?: string;

  @IsOptional()
  @IsString()
  id?: string;
}

export class ExecutePipelineDto {
  @IsOptional()
  @IsIn(PIPELINE_SOURCES)
  source?: PipelineSource;

  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PipelineRecordDto)
  records?: PipelineRecordDto[];

  @IsOptional()
  @IsNumber()
  limit?: number;
}

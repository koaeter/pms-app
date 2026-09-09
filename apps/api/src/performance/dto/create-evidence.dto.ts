import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateEvidenceDto {
  @IsString() @MaxLength(255) fileName!: string;
  @IsString() @MaxLength(1000) storageKey!: string;
  @IsOptional() @IsString() @MaxLength(255) mimeType?: string;
  @IsOptional() fileSize?: number;
  @IsOptional() @IsString() @MaxLength(128) checksum?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUUID() performanceKpiId?: string;
  @IsOptional() @IsUUID() performanceCompetencyId?: string;
}

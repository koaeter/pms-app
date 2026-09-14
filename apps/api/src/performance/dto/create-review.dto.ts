import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class ReviewKpiDto {
  @IsUUID() kpiId!: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() target?: string;
  @IsOptional() @IsString() measurementUnit?: string;
  @IsNumber() @Min(0) weight!: number;
}

export class ReviewCompetencyDto {
  @IsUUID() competencyId!: string;
  @IsNumber() @Min(0) weight!: number;
}

export class CreateReviewDto {
  @IsUUID() employeeId!: string;
  @IsUUID() performanceCycleId!: string;
  @IsUUID() reviewTypeId!: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ReviewKpiDto) kpis?: ReviewKpiDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ReviewCompetencyDto) competencies?: ReviewCompetencyDto[];
}

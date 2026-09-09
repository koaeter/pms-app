import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ReportingRelationshipType } from '@prisma/client';

export class CreateReportingRelationshipDto {
  @IsUUID() employeeId!: string;
  @IsUUID() reportsToEmployeeId!: string;
  @IsOptional() @IsEnum(ReportingRelationshipType) relationshipType?: ReportingRelationshipType;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
}

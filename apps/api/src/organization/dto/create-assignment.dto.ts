import { IsBoolean, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateAssignmentDto {
  @IsUUID() employeeId!: string;
  @IsUUID() organizationalUnitId!: string;
  @IsOptional() @IsUUID() designationId?: string;
  @IsOptional() @IsUUID() supervisorEmployeeId?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
}

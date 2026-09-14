import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { WorkflowActorType } from '@prisma/client';

export class WorkflowStepDto {
  @IsInt() @Min(1) stepOrder!: number;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsEnum(WorkflowActorType) actorType!: WorkflowActorType;
  @IsOptional() @IsUUID() actorRoleId?: string;
  @IsOptional() @IsUUID() actorUserId?: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsBoolean() canReturn?: boolean;
  @IsOptional() @IsBoolean() canReject?: boolean;
}

export class CreateWorkflowDto {
  @IsString() @MaxLength(200) name!: string;
  @IsString() @MaxLength(100) code!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsUUID() performanceReviewTypeId?: string;
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps!: WorkflowStepDto[];
}

import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class WorkflowActionDto {
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
  @IsOptional() @IsUUID() delegateToUserId?: string;
}

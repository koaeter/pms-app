import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateKpiDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(1) code!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() measurementMethod?: string;
  @IsOptional() @IsString() defaultUnit?: string;
}

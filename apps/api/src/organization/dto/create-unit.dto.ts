import { IsOptional, IsString, MinLength, IsInt, Min } from 'class-validator';

export class CreateUnitDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(1) code!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsString() unitTypeId?: string;
  @IsOptional() @IsString() headEmployeeId?: string;
  @IsOptional() @IsInt() @Min(0) level?: number;
}

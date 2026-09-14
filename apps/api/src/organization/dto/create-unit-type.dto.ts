import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateUnitTypeDto {
  @IsString() @MaxLength(200) name!: string;
  @IsString() @MaxLength(100) code!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsInt() @Min(0) level?: number;
}

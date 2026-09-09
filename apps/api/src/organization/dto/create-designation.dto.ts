import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDesignationDto {
  @IsString() @MaxLength(200) name!: string;
  @IsString() @MaxLength(100) code!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(100) gradeLevel?: string;
}

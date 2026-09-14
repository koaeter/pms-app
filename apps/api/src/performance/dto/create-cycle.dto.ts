import { IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateCycleDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsOptional()
  @IsInt()
  @Min(2000)
  year?: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

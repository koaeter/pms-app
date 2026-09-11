import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateKpiScoreDto {
  @IsNumber() @Min(0) @Max(100) score!: number;
  @IsOptional() @IsString() actualResult?: string;
  @IsOptional() @IsString() comment?: string;
}

import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateCompetencyRatingDto {
  @IsNumber() @Min(0) @Max(100) rating!: number;
  @IsOptional() @IsString() comment?: string;
}

import { IsOptional, IsUUID } from 'class-validator';

export class CalculateScoreDto {
  @IsOptional() @IsUUID() ratingScaleId?: string;
}

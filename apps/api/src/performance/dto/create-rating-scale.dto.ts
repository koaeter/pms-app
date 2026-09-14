import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

export class RatingScaleItemDto {
  @IsNumber() value!: number;
  @IsString() @MinLength(1) label!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() minScore?: number;
  @IsOptional() @IsNumber() maxScore?: number;
}

export class CreateRatingScaleDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(1) code!: string;
  @IsOptional() @IsString() description?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RatingScaleItemDto)
  items!: RatingScaleItemDto[];
}

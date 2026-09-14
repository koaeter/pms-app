import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEmployeeDto {
  @IsString() @MinLength(1) employeeNumber!: string;
  @IsString() @MinLength(1) firstName!: string;
  @IsOptional() @IsString() middleName?: string;
  @IsString() @MinLength(1) lastName!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() designationId?: string;
}

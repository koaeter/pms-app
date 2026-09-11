import { IsEnum } from 'class-validator';
import { AccountStatus } from '@prisma/client';

export class ChangeUserStatusDto {
  @IsEnum(AccountStatus)
  status!: AccountStatus;
}

import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { SUPPORTED_CURRENCIES } from '../../../shared/constants/currencies';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @IsString()
  @IsIn(SUPPORTED_CURRENCIES)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  currency!: string;
}

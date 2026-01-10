import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description!: string;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  totalAmount!: number;

  @IsString()
  @IsUUID()
  payerId!: string;

  @IsArray()
  @IsString({ each: true })
  participantIds!: string[];

  @IsString()
  @IsIn(['equal', 'consumption'])
  divisionMethod!: 'equal' | 'consumption';

  @ValidateIf((o) => o.divisionMethod === 'consumption')
  @IsObject()
  @IsNotEmptyObject()
  @Transform(({ value }) => {
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, Number(val)]));
  })
  consumptions?: Record<string, number>;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsNumber()
  tipAmount?: number;

  @IsOptional()
  @IsString()
  birthdayPersonId?: string;
}

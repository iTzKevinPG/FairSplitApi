import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ConsumptionsDto {
  [key: string]: number;
}

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
  @ValidateNested()
  @Type(() => ConsumptionsDto)
  @IsOptional()
  consumptions?: Record<string, number>;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsNumber()
  tipAmount?: number;

  @IsOptional()
  @IsString()
  birthdayPersonId?: string;
}

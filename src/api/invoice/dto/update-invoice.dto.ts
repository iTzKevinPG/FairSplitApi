import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';

class InvoiceItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  @Min(0.01)
  unitPrice!: number;

  @IsInt()
  @Transform(({ value }) => Number(value))
  @Min(1)
  quantity!: number;

  @IsArray()
  @IsUUID('4', { each: true })
  participantIds!: string[];
}

export class UpdateInvoiceDto {
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsNumber()
  tipAmount?: number;

  @IsOptional()
  @IsString()
  birthdayPersonId?: string;
}

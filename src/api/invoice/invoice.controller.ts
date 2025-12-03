import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CreateInvoiceUseCase } from '../../application/use-cases/create-invoice.use-case';
import { Invoice } from '../../domain/invoice/invoice';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Controller('events/:eventId/invoices')
export class InvoiceController {
  constructor(private readonly _createInvoice: CreateInvoiceUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('eventId') eventId: string,
    @Body() body: CreateInvoiceDto,
  ): Promise<Invoice> {
    return this._createInvoice.execute({
      eventId,
      description: body.description,
      totalAmount: body.totalAmount,
      payerId: body.payerId,
      participantIds: body.participantIds,
      divisionMethod: body.divisionMethod,
      consumptions: body.consumptions,
      tipAmount: body.tipAmount,
      birthdayPersonId: body.birthdayPersonId,
    });
  }
}

import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CreateInvoiceUseCase } from '../../application/use-cases/create-invoice.use-case';
import { GetInvoiceUseCase } from '../../application/use-cases/get-invoice.use-case';
import { ListInvoicesUseCase } from '../../application/use-cases/list-invoices.use-case';
import { Invoice } from '../../domain/invoice/invoice';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Controller('events/:eventId/invoices')
export class InvoiceController {
  constructor(
    private readonly _createInvoice: CreateInvoiceUseCase,
    private readonly _listInvoices: ListInvoicesUseCase,
    private readonly _getInvoice: GetInvoiceUseCase,
  ) {}

  @Get()
  async list(@Param('eventId') eventId: string) {
    return this._listInvoices.execute(eventId);
  }

  @Get(':invoiceId')
  async getOne(@Param('eventId') eventId: string, @Param('invoiceId') invoiceId: string) {
    return this._getInvoice.execute(eventId, invoiceId);
  }

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

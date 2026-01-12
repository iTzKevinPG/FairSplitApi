import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateInvoiceUseCase } from '../../application/use-cases/create-invoice.use-case';
import { GetInvoiceUseCase } from '../../application/use-cases/get-invoice.use-case';
import { ListInvoicesUseCase } from '../../application/use-cases/list-invoices.use-case';
import { RemoveInvoiceUseCase } from '../../application/use-cases/remove-invoice.use-case';
import { UpdateInvoiceUseCase } from '../../application/use-cases/update-invoice.use-case';
import { Invoice } from '../../domain/invoice/invoice';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';

@Controller('events/:eventId/invoices')
@UseGuards(AuthGuard)
export class InvoiceController {
  constructor(
    private readonly _createInvoice: CreateInvoiceUseCase,
    private readonly _listInvoices: ListInvoicesUseCase,
    private readonly _getInvoice: GetInvoiceUseCase,
    private readonly _removeInvoice: RemoveInvoiceUseCase,
    private readonly _updateInvoice: UpdateInvoiceUseCase,
  ) {}

  @Get()
  async list(@Param('eventId') eventId: string, @CurrentUser() user: { id: string }) {
    return this._listInvoices.execute(eventId, user.id);
  }

  @Get(':invoiceId')
  async getOne(
    @Param('eventId') eventId: string,
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this._getInvoice.execute(eventId, invoiceId, user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('eventId') eventId: string,
    @Body() body: CreateInvoiceDto,
    @CurrentUser() user: { id: string },
  ): Promise<Invoice> {
    return this._createInvoice.execute({
      eventId,
      description: body.description,
      totalAmount: body.totalAmount,
      payerId: body.payerId,
      participantIds: body.participantIds,
      divisionMethod: body.divisionMethod,
      consumptions: body.consumptions,
      items: body.items,
      tipAmount: body.tipAmount,
      birthdayPersonId: body.birthdayPersonId,
      userId: user.id,
    });
  }

  @Patch(':invoiceId')
  async update(
    @Param('eventId') eventId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: UpdateInvoiceDto,
    @CurrentUser() user: { id: string },
  ): Promise<Invoice> {
    return this._updateInvoice.execute({
      eventId,
      invoiceId,
      description: body.description,
      totalAmount: body.totalAmount,
      payerId: body.payerId,
      participantIds: body.participantIds,
      divisionMethod: body.divisionMethod,
      consumptions: body.consumptions,
      items: body.items,
      tipAmount: body.tipAmount,
      birthdayPersonId: body.birthdayPersonId,
      userId: user.id,
    });
  }

  @Delete(':invoiceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('eventId') eventId: string,
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    await this._removeInvoice.execute(eventId, invoiceId, user.id);
  }
}

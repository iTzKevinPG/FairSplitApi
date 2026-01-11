import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventRepository } from '../ports/event-repository';
import { InvoiceRepository } from '../ports/invoice-repository';

@Injectable()
export class RemoveInvoiceUseCase {
  constructor(
    @Inject('EventRepository') private readonly _eventRepository: EventRepository,
    @Inject('InvoiceRepository') private readonly _invoiceRepository: InvoiceRepository,
  ) {}

  async execute(eventId: string, invoiceId: string, userId: string): Promise<void> {
    const event = await this._eventRepository.findByIdForUser(eventId, userId);
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    }

    const invoice = await this._invoiceRepository.findById(invoiceId);
    if (!invoice || invoice.eventId !== event.id) {
      throw new NotFoundException({ code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
    }

    await this._invoiceRepository.remove(invoiceId);
  }
}

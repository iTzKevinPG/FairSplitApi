import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventRepository } from '../ports/event-repository';
import { InvoiceRepository } from '../ports/invoice-repository';
import { ParticipantRepository } from '../ports/participant-repository';

type InvoiceListItem = {
  id: string;
  description: string;
  totalAmount: number;
  payerId: string;
  payerName: string;
  participantsCount: number;
  divisionMethod: 'equal' | 'consumption';
  tipAmount?: number;
  birthdayPersonId?: string;
};

@Injectable()
export class ListInvoicesUseCase {
  constructor(
    @Inject('InvoiceRepository') private readonly _invoiceRepository: InvoiceRepository,
    @Inject('EventRepository') private readonly _eventRepository: EventRepository,
    @Inject('ParticipantRepository') private readonly _participantRepository: ParticipantRepository,
  ) {}

  async execute(eventId: string, userId: string): Promise<InvoiceListItem[]> {
    const event = await this._eventRepository.findByIdForUser(eventId, userId);
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    }

    const invoices = await this._invoiceRepository.findByEvent(event.id);
    const payerNames = new Map<string, string>();

    return Promise.all(
      invoices.map(async (inv) => {
        let payerName = payerNames.get(inv.payerId);
        if (!payerName) {
          const person = await this._participantRepository.findById(event.id, inv.payerId);
          payerName = person?.name ?? '';
          payerNames.set(inv.payerId, payerName);
        }
        return {
          id: inv.id,
          description: inv.description,
          totalAmount: inv.amount,
          payerId: inv.payerId,
          payerName,
          participantsCount: inv.participations.length,
          divisionMethod: inv.divisionMethod,
          tipAmount: inv.tipAmount,
          birthdayPersonId: inv.birthdayPersonId,
        };
      }),
    );
  }
}

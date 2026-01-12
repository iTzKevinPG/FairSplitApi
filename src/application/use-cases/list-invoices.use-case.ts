import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventRepository } from '../ports/event-repository';
import { InvoiceRepository } from '../ports/invoice-repository';
import { ParticipantRepository } from '../ports/participant-repository';
import type { DivisionMethod } from '../../domain/invoice/invoice';

type InvoiceParticipationDetail = {
  participantId: string;
  participantName: string;
  amountAssigned: number;
  baseAmount: number;
  tipShare: number;
  isBirthdayPerson: boolean;
};

type InvoiceItemDetail = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  total: number;
  participantIds: string[];
};

type InvoiceDetail = {
  id: string;
  eventId: string;
  description: string;
  totalAmount: number;
  divisionMethod: DivisionMethod;
  payerId: string;
  payerName: string;
  tipAmount?: number;
  birthdayPersonId?: string;
  participations: InvoiceParticipationDetail[];
  items?: InvoiceItemDetail[];
};

@Injectable()
export class ListInvoicesUseCase {
  constructor(
    @Inject('InvoiceRepository') private readonly _invoiceRepository: InvoiceRepository,
    @Inject('EventRepository') private readonly _eventRepository: EventRepository,
    @Inject('ParticipantRepository') private readonly _participantRepository: ParticipantRepository,
  ) {}

  async execute(eventId: string, userId: string): Promise<InvoiceDetail[]> {
    const event = await this._eventRepository.findByIdForUser(eventId, userId);
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    }

    const invoices = await this._invoiceRepository.findByEvent(event.id);
    const participants = await this._participantRepository.findByEvent(event.id);
    const participantNames = new Map(participants.map((p) => [p.id, p.name]));

    return invoices.map((inv) => {
      const payerName = participantNames.get(inv.payerId) ?? '';
      const participations = inv.participations.map((p) => ({
        participantId: p.personId,
        participantName: participantNames.get(p.personId) ?? '',
        amountAssigned: this.round2(p.finalAmount),
        baseAmount: this.round2(p.baseAmount),
        tipShare: this.round2(p.tipShare),
        isBirthdayPerson: inv.birthdayPersonId === p.personId,
      }));
      const items =
        inv.items?.map((item) => ({
          id: item.id,
          name: item.name,
          unitPrice: this.round2(item.unitPrice),
          quantity: item.quantity,
          total: this.round2(item.total),
          participantIds: item.assignments.map((assignment) => assignment.personId),
        })) ?? undefined;
      return {
        id: inv.id,
        eventId: inv.eventId,
        description: inv.description,
        totalAmount: inv.amount,
        divisionMethod: inv.divisionMethod,
        payerId: inv.payerId,
        payerName,
        tipAmount: inv.tipAmount,
        birthdayPersonId: inv.birthdayPersonId,
        participations,
        items,
      };
    });
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

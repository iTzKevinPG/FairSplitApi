import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DivisionMethod } from '../../domain/invoice/invoice';
import { EventRepository } from '../ports/event-repository';
import { InvoiceRepository } from '../ports/invoice-repository';
import { ParticipantRepository } from '../ports/participant-repository';

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
export class GetInvoiceUseCase {
  constructor(
    @Inject('InvoiceRepository') private readonly _invoiceRepository: InvoiceRepository,
    @Inject('EventRepository') private readonly _eventRepository: EventRepository,
    @Inject('ParticipantRepository') private readonly _participantRepository: ParticipantRepository,
  ) {}

  async execute(eventId: string, invoiceId: string, userId: string): Promise<InvoiceDetail> {
    const event = await this._eventRepository.findByIdForUser(eventId, userId);
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    }
    const invoice = await this._invoiceRepository.findById(invoiceId);
    if (!invoice || invoice.eventId !== event.id) {
      throw new NotFoundException({ code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
    }

    const participations: InvoiceParticipationDetail[] = [];

    for (const participation of invoice.participations) {
      const person = await this._participantRepository.findById(event.id, participation.personId);
      const name = person?.name ?? '';
      const tipShare = this.round2(participation.tipShare);
      const baseAmount = this.round2(participation.baseAmount);
      participations.push({
        participantId: participation.personId,
        participantName: name,
        amountAssigned: this.round2(participation.finalAmount),
        baseAmount,
        tipShare,
        isBirthdayPerson: invoice.birthdayPersonId === participation.personId,
      });
    }

    const payer = await this._participantRepository.findById(event.id, invoice.payerId);

    return {
      id: invoice.id,
      eventId: invoice.eventId,
      description: invoice.description,
      totalAmount: invoice.amount,
      divisionMethod: invoice.divisionMethod,
      payerId: invoice.payerId,
      payerName: payer?.name ?? '',
      tipAmount: invoice.tipAmount,
      birthdayPersonId: invoice.birthdayPersonId,
      participations,
      items:
        invoice.items?.map((item) => ({
          id: item.id,
          name: item.name,
          unitPrice: this.round2(item.unitPrice),
          quantity: item.quantity,
          total: this.round2(item.total),
          participantIds: item.assignments.map((assignment) => assignment.personId),
        })) ?? undefined,
    };
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

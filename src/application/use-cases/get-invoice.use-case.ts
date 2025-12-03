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
};

@Injectable()
export class GetInvoiceUseCase {
  constructor(
    @Inject('InvoiceRepository') private readonly _invoiceRepository: InvoiceRepository,
    @Inject('EventRepository') private readonly _eventRepository: EventRepository,
    @Inject('ParticipantRepository') private readonly _participantRepository: ParticipantRepository,
  ) {}

  async execute(eventId: string, invoiceId: string): Promise<InvoiceDetail> {
    const event = await this._eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    }
    const invoice = await this._invoiceRepository.findById(invoiceId);
    if (!invoice || invoice.eventId !== event.id) {
      throw new NotFoundException({ code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
    }

    const tipShares = this.calculateTipShares(invoice.tipAmount ?? 0, invoice.participations);
    const participations: InvoiceParticipationDetail[] = [];

    for (const participation of invoice.participations) {
      const person = await this._participantRepository.findById(event.id, participation.personId);
      const name = person?.name ?? '';
      const tipShare = tipShares.get(participation.personId) ?? 0;
      const baseAmount = this.round2(participation.amount - tipShare);
      participations.push({
        participantId: participation.personId,
        participantName: name,
        amountAssigned: this.round2(participation.amount),
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
    };
  }

  private calculateTipShares(tipAmount: number, participations: { personId: string }[]) {
    const shares = new Map<string, number>();
    const n = participations.length;
    if (tipAmount <= 0 || n === 0) {
      participations.forEach((p) => shares.set(p.personId, 0));
      return shares;
    }
    const tipPer = this.round2(tipAmount / n);
    let allocated = 0;
    participations.forEach((p, idx) => {
      if (idx === participations.length - 1) {
        shares.set(p.personId, this.round2(tipAmount - allocated));
      } else {
        shares.set(p.personId, tipPer);
        allocated += tipPer;
      }
    });
    return shares;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

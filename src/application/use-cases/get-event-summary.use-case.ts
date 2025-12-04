import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventRepository } from '../ports/event-repository';
import { InvoiceRepository } from '../ports/invoice-repository';
import { ParticipantRepository } from '../ports/participant-repository';

export type SummaryItem = {
  participantId: string;
  participantName: string;
  totalPaid: number;
  totalShouldPay: number;
  netBalance: number;
  status: 'creditor' | 'debtor' | 'settled';
};

@Injectable()
export class GetEventSummaryUseCase {
  constructor(
    @Inject('InvoiceRepository') private readonly _invoiceRepository: InvoiceRepository,
    @Inject('ParticipantRepository') private readonly _participantRepository: ParticipantRepository,
    @Inject('EventRepository') private readonly _eventRepository: EventRepository,
  ) {}

  async execute(eventId: string): Promise<SummaryItem[]> {
    const event = await this._eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    }

    const participants = await this._participantRepository.findByEvent(event.id);
    const invoices = await this._invoiceRepository.findByEvent(event.id);

    const totals = new Map<string, { paid: number; owed: number; name: string }>();
    participants.forEach((p) => totals.set(p.id, { paid: 0, owed: 0, name: p.name }));

    invoices.forEach((inv) => {
      const totalWithTip = inv.amount + (inv.tipAmount ?? 0);
      const payerTotals = totals.get(inv.payerId);
      if (payerTotals) {
        payerTotals.paid = this.round2(payerTotals.paid + totalWithTip);
      }
      inv.participations.forEach((part) => {
        const t = totals.get(part.personId);
        if (t) {
          t.owed = this.round2(t.owed + part.finalAmount);
        }
      });
    });

    const summary: SummaryItem[] = [];
    totals.forEach((value, participantId) => {
      const net = this.round2(value.paid - value.owed);
      const normalizedNet = Math.abs(net) < 0.01 ? 0 : net;
      const status =
        normalizedNet > 0 ? 'creditor' : normalizedNet < 0 ? 'debtor' : ('settled' as const);
      summary.push({
        participantId,
        participantName: value.name,
        totalPaid: this.round2(value.paid),
        totalShouldPay: this.round2(value.owed),
        netBalance: normalizedNet,
        status,
      });
    });

    return summary;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

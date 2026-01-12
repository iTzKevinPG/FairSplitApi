import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventRepository } from '../ports/event-repository';
import { ParticipantRepository } from '../ports/participant-repository';
import { InvoiceRepository } from '../ports/invoice-repository';
import { TransferStatusRepository } from '../ports/transfer-status-repository';
import { Participation } from '../../domain/invoice/participation';
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

type SummaryItem = {
  participantId: string;
  participantName: string;
  totalPaid: number;
  totalShouldPay: number;
  netBalance: number;
  status: 'creditor' | 'debtor' | 'settled';
};

type TransferItem = {
  fromParticipantId: string;
  fromName: string;
  toParticipantId: string;
  toName: string;
  amount: number;
};

type TransferStatusItem = {
  fromParticipantId: string;
  toParticipantId: string;
  isSettled: boolean;
  settledAt?: string | null;
};

type PublicOverviewPayload = {
  event: {
    id: string;
    name: string;
    currency: string;
  };
  participants: Array<{ id: string; name: string }>;
  invoices: InvoiceDetail[];
  balances: SummaryItem[];
  transfers: TransferItem[];
  transferStatuses: TransferStatusItem[];
};

@Injectable()
export class GetPublicEventOverviewUseCase {
  constructor(
    @Inject('EventRepository') private readonly _eventRepository: EventRepository,
    @Inject('ParticipantRepository') private readonly _participantRepository: ParticipantRepository,
    @Inject('InvoiceRepository') private readonly _invoiceRepository: InvoiceRepository,
    @Inject('TransferStatusRepository')
    private readonly _transferStatusRepository: TransferStatusRepository,
  ) {}

  async execute(eventId: string): Promise<PublicOverviewPayload> {
    const event = await this._eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    }

    const [participants, invoices, transferStatuses] = await Promise.all([
      this._participantRepository.findByEvent(event.id),
      this._invoiceRepository.findByEvent(event.id),
      this._transferStatusRepository.findByEvent(event.id),
    ]);

    const participantNames = new Map(participants.map((p) => [p.id, p.name]));
    const invoiceDetails: InvoiceDetail[] = invoices.map((inv) => {
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

    const balances = this.buildSummary(participants, invoices);
    const transfers = this.buildTransfers(balances);
    const transferStatusItems = transferStatuses.map((status) => ({
      fromParticipantId: status.fromParticipantId,
      toParticipantId: status.toParticipantId,
      isSettled: status.isSettled,
      settledAt: status.settledAt ? status.settledAt.toISOString() : null,
    }));

    return {
      event: {
        id: event.id,
        name: event.name,
        currency: event.currency,
      },
      participants: participants.map((p) => ({ id: p.id, name: p.name })),
      invoices: invoiceDetails,
      balances,
      transfers,
      transferStatuses: transferStatusItems,
    };
  }

  private buildSummary(
    participants: Array<{ id: string; name: string }>,
    invoices: Array<{
      amount: number;
      payerId: string;
      tipAmount?: number;
      participations: Participation[];
    }>,
  ): SummaryItem[] {
    const totals = new Map<string, { paid: number; owed: number; name: string }>();
    participants.forEach((p) => totals.set(p.id, { paid: 0, owed: 0, name: p.name }));

    invoices.forEach((inv) => {
      const totalWithTip = inv.amount + (inv.tipAmount ?? 0);
      const payerTotals = totals.get(inv.payerId);
      if (payerTotals) {
        payerTotals.paid = this.round2(payerTotals.paid + totalWithTip);
      }
      inv.participations.forEach((part: Participation) => {
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

  private buildTransfers(summary: SummaryItem[]): TransferItem[] {
    const creditors = summary
      .filter((s) => s.netBalance > 0.009)
      .map((s) => ({ ...s }))
      .sort((a, b) => b.netBalance - a.netBalance);
    const debtors = summary
      .filter((s) => s.netBalance < -0.009)
      .map((s) => ({ ...s }))
      .sort((a, b) => a.netBalance - b.netBalance);

    const transfers: TransferItem[] = [];
    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const payAmount = this.round2(
        Math.min(Math.abs(debtor.netBalance), Math.abs(creditor.netBalance)),
      );
      transfers.push({
        fromParticipantId: debtor.participantId,
        fromName: debtor.participantName,
        toParticipantId: creditor.participantId,
        toName: creditor.participantName,
        amount: payAmount,
      });
      debtor.netBalance = this.round2(debtor.netBalance + payAmount);
      creditor.netBalance = this.round2(creditor.netBalance - payAmount);

      if (Math.abs(debtor.netBalance) < 0.01) i++;
      if (Math.abs(creditor.netBalance) < 0.01) j++;
    }

    return transfers;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

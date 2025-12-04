import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetEventSummaryUseCase } from './get-event-summary.use-case';

@Injectable()
export class GetEventTransfersUseCase {
  constructor(
    @Inject(GetEventSummaryUseCase) private readonly _getEventSummary: GetEventSummaryUseCase,
  ) {}

  async execute(eventId: string) {
    const summary = await this._getEventSummary.execute(eventId).catch((err) => {
      if (err instanceof NotFoundException) throw err;
      throw err;
    });

    const creditors = summary
      .filter((s) => s.netBalance > 0.009)
      .map((s) => ({ ...s }))
      .sort((a, b) => b.netBalance - a.netBalance);
    const debtors = summary
      .filter((s) => s.netBalance < -0.009)
      .map((s) => ({ ...s }))
      .sort((a, b) => a.netBalance - b.netBalance);

    const transfers: Array<{
      fromParticipantId: string;
      fromName: string;
      toParticipantId: string;
      toName: string;
      amount: number;
    }> = [];

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

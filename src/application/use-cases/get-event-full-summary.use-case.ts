import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventRepository } from '../ports/event-repository';
import { ParticipantRepository } from '../ports/participant-repository';
import { ListInvoicesUseCase } from './list-invoices.use-case';
import { GetEventSummaryUseCase } from './get-event-summary.use-case';
import { GetEventTransfersUseCase } from './get-event-transfers.use-case';

type FullSummaryPayload = {
  event: {
    id: string;
    name: string;
    currency: string;
  };
  participants: Array<{ id: string; name: string }>;
  invoices: Awaited<ReturnType<ListInvoicesUseCase['execute']>>;
  balances: Awaited<ReturnType<GetEventSummaryUseCase['execute']>>;
  transfers: Awaited<ReturnType<GetEventTransfersUseCase['execute']>>;
};

@Injectable()
export class GetEventFullSummaryUseCase {
  constructor(
    @Inject('EventRepository') private readonly _eventRepository: EventRepository,
    @Inject('ParticipantRepository') private readonly _participantRepository: ParticipantRepository,
    private readonly _listInvoices: ListInvoicesUseCase,
    private readonly _getSummary: GetEventSummaryUseCase,
    private readonly _getTransfers: GetEventTransfersUseCase,
  ) {}

  async execute(eventId: string): Promise<FullSummaryPayload> {
    const event = await this._eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    }

    const [participants, invoices, balances, transfers] = await Promise.all([
      this._participantRepository.findByEvent(event.id),
      this._listInvoices.execute(event.id),
      this._getSummary.execute(event.id),
      this._getTransfers.execute(event.id),
    ]);

    return {
      event: {
        id: event.id,
        name: event.name,
        currency: event.currency,
      },
      participants: participants.map((p) => ({ id: p.id, name: p.name })),
      invoices,
      balances,
      transfers,
    };
  }
}

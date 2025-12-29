import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventRepository } from '../ports/event-repository';
import { TransferStatusRepository } from '../ports/transfer-status-repository';

@Injectable()
export class UpsertTransferStatusUseCase {
  constructor(
    @Inject('EventRepository') private readonly _eventRepository: EventRepository,
    @Inject('TransferStatusRepository')
    private readonly _transferStatusRepository: TransferStatusRepository,
  ) {}

  async execute(input: {
    eventId: string;
    userId: string;
    fromParticipantId: string;
    toParticipantId: string;
    isSettled: boolean;
  }) {
    const event = await this._eventRepository.findByIdForUser(input.eventId, input.userId);
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    }
    return this._transferStatusRepository.upsertStatus({
      eventId: input.eventId,
      fromParticipantId: input.fromParticipantId,
      toParticipantId: input.toParticipantId,
      isSettled: input.isSettled,
    });
  }
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventRepository } from '../ports/event-repository';
import { TransferStatusRepository } from '../ports/transfer-status-repository';

@Injectable()
export class GetTransferStatusUseCase {
  constructor(
    @Inject('EventRepository') private readonly _eventRepository: EventRepository,
    @Inject('TransferStatusRepository')
    private readonly _transferStatusRepository: TransferStatusRepository,
  ) {}

  async execute(eventId: string, userId: string) {
    const event = await this._eventRepository.findByIdForUser(eventId, userId);
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    }
    return this._transferStatusRepository.findByEvent(eventId);
  }
}

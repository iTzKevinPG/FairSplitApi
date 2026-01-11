import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventRepository } from '../ports/event-repository';

@Injectable()
export class RemoveEventUseCase {
  constructor(@Inject('EventRepository') private readonly _eventRepository: EventRepository) {}

  async execute(eventId: string, userId: string): Promise<void> {
    const deleted = await this._eventRepository.deleteForUser(eventId, userId);
    if (!deleted) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    }
  }
}

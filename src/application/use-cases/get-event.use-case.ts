import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventRepository } from '../ports/event-repository';

@Injectable()
export class GetEventUseCase {
  constructor(@Inject('EventRepository') private readonly _eventRepository: EventRepository) {}

  async execute(id: string) {
    const event = await this._eventRepository.findById(id);
    if (!event) {
      throw new NotFoundException({
        code: 'EVENT_NOT_FOUND',
        message: 'Event not found',
      });
    }
    return event;
  }
}

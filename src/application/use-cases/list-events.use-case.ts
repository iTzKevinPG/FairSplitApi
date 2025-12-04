import { Inject, Injectable } from '@nestjs/common';
import { EventRepository } from '../ports/event-repository';

@Injectable()
export class ListEventsUseCase {
  constructor(@Inject('EventRepository') private readonly _eventRepository: EventRepository) {}

  async execute(userId: string) {
    return this._eventRepository.findAllByUser(userId);
  }
}

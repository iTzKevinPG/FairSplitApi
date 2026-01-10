import { Inject, Injectable } from '@nestjs/common';
import { EventRepository } from '../ports/event-repository';
import type { EventSummaryDTO } from '../dto/EventSummaryDTO';

@Injectable()
export class ListEventsUseCase {
  constructor(@Inject('EventRepository') private readonly _eventRepository: EventRepository) {}

  async execute(userId: string): Promise<EventSummaryDTO[]> {
    return this._eventRepository.findAllByUser(userId);
  }
}

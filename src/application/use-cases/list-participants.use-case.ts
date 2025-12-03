import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventRepository } from '../ports/event-repository';
import { ParticipantRepository } from '../ports/participant-repository';

@Injectable()
export class ListParticipantsUseCase {
  constructor(
    @Inject('ParticipantRepository') private readonly _participantRepository: ParticipantRepository,
    @Inject('EventRepository') private readonly _eventRepository: EventRepository,
  ) {}

  async execute(eventId: string) {
    const event = await this._eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    }
    return this._participantRepository.findByEvent(event.id);
  }
}

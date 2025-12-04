import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventRepository } from '../ports/event-repository';
import { ParticipantRepository } from '../ports/participant-repository';
import { Person } from '../../domain/person/person';

type UpdateParticipantInput = {
  eventId: string;
  participantId: string;
  name: string;
  userId: string;
};

@Injectable()
export class UpdateParticipantUseCase {
  constructor(
    @Inject('ParticipantRepository') private readonly _participantRepository: ParticipantRepository,
    @Inject('EventRepository') private readonly _eventRepository: EventRepository,
  ) {}

  async execute(input: UpdateParticipantInput): Promise<Person> {
    const name = input.name?.trim();
    const fieldErrors: Record<string, string> = {};
    if (!name) {
      fieldErrors.name = 'Name is required';
    }
    if (Object.keys(fieldErrors).length > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid participant data',
        fieldErrors,
      });
    }

    const event = await this._eventRepository.findByIdForUser(input.eventId, input.userId);
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    }

    const existing = await this._participantRepository.findById(event.id, input.participantId);
    if (!existing) {
      throw new NotFoundException({
        code: 'PARTICIPANT_NOT_FOUND',
        message: 'Participant not found',
      });
    }

    const updated = new Person(existing.id, name);
    return this._participantRepository.update(event.id, updated);
  }
}

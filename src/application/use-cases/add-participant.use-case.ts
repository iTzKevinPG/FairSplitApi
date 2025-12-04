import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EventRepository } from '../ports/event-repository';
import { ParticipantRepository } from '../ports/participant-repository';
import { Person } from '../../domain/person/person';

type AddParticipantInput = {
  eventId: string;
  name: string;
  userId: string;
};

@Injectable()
export class AddParticipantUseCase {
  constructor(
    @Inject('ParticipantRepository') private readonly _participantRepository: ParticipantRepository,
    @Inject('EventRepository') private readonly _eventRepository: EventRepository,
  ) {}

  async execute(input: AddParticipantInput): Promise<Person> {
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

    const person = new Person(randomUUID(), name);
    return this._participantRepository.add(event.id, person);
  }
}

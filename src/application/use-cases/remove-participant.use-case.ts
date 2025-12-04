import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventRepository } from '../ports/event-repository';
import { ParticipantRepository } from '../ports/participant-repository';

type RemoveParticipantInput = {
  eventId: string;
  participantId: string;
  userId: string;
};

@Injectable()
export class RemoveParticipantUseCase {
  constructor(
    @Inject('ParticipantRepository') private readonly _participantRepository: ParticipantRepository,
    @Inject('EventRepository') private readonly _eventRepository: EventRepository,
  ) {}

  async execute(input: RemoveParticipantInput): Promise<void> {
    const event = await this._eventRepository.findByIdForUser(input.eventId, input.userId);
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    }

    const participant = await this._participantRepository.findById(event.id, input.participantId);
    if (!participant) {
      throw new NotFoundException({
        code: 'PARTICIPANT_NOT_FOUND',
        message: 'Participant not found',
      });
    }

    const hasInvoices = await this._participantRepository.hasInvoices(event.id, participant.id);
    if (hasInvoices) {
      throw new ConflictException({
        code: 'PARTICIPANT_HAS_INVOICES',
        message: 'Cannot delete participant with associated invoices',
      });
    }

    await this._participantRepository.remove(event.id, participant.id);
  }
}

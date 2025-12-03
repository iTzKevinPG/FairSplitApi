import { Injectable } from '@nestjs/common';
import { ParticipantRepository } from '../ports/ParticipantRepository';

@Injectable()
export class AddParticipantUseCase {
  constructor(private readonly _participantRepository: ParticipantRepository) {}

  // TODO: implement use case
  async execute(): Promise<void> {
    throw new Error('Not implemented');
  }
}

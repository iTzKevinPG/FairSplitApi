import { Injectable } from '@nestjs/common';
import { EventRepository } from '../ports/EventRepository';

@Injectable()
export class CreateEventUseCase {
  constructor(private readonly _eventRepository: EventRepository) {}

  // TODO: implement use case
  async execute(): Promise<void> {
    throw new Error('Not implemented');
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { EventRepository } from '../ports/event-repository';

type CreateEventInput = {
  name: string;
  currency: string;
};

@Injectable()
export class CreateEventUseCase {
  constructor(@Inject('EventRepository') private readonly _eventRepository: EventRepository) {}

  async execute(input: CreateEventInput) {
    return this._eventRepository.create({
      name: input.name,
      currency: input.currency,
    });
  }
}

import { EventId } from './event-id';

export class Event {
  constructor(
    public readonly id: EventId,
    public name: string,
    public currency: string,
    public readonly createdAt?: Date,
  ) {}
}

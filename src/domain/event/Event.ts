import { EventId } from './EventId';

export class Event {
  constructor(
    public readonly id: EventId,
    public name: string,
    public currency: string,
  ) {}
}

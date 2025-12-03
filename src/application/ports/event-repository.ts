import { Event } from '../../domain/event/event';
import { EventId } from '../../domain/event/event-id';

export interface EventRepository {
  create(input: { name: string; currency: string }): Promise<Event>;
  findById(id: EventId): Promise<Event | null>;
  findAll(): Promise<Event[]>;
}

import { Event } from '../../domain/event/Event';
import { EventId } from '../../domain/event/EventId';

export interface EventRepository {
  create(event: Event): Promise<Event>;
  findById(id: EventId): Promise<Event | null>;
  findAll(): Promise<Event[]>;
}

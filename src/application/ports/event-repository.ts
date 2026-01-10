import { Event } from '../../domain/event/event';
import { EventId } from '../../domain/event/event-id';
import type { EventSummaryDTO } from '../dto/EventSummaryDTO';

export interface EventRepository {
  create(input: { name: string; currency: string; userId: string }): Promise<Event>;
  findByIdForUser(id: EventId, userId: string): Promise<Event | null>;
  findAllByUser(userId: string): Promise<EventSummaryDTO[]>;
}

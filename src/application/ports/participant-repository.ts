import { Person } from '../../domain/person/person';

export interface ParticipantRepository {
  add(eventId: string, person: Person): Promise<Person>;
  update(eventId: string, person: Person): Promise<Person>;
  remove(eventId: string, personId: string): Promise<void>;
  findById(eventId: string, personId: string): Promise<Person | null>;
  findByEvent(eventId: string): Promise<Person[]>;
  hasInvoices(eventId: string, personId: string): Promise<boolean>;
}

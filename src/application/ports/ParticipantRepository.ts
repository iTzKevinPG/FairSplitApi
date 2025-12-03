import { Person } from '../../domain/person/Person';

export interface ParticipantRepository {
  add(eventId: string, person: Person): Promise<Person>;
  update(eventId: string, person: Person): Promise<Person>;
  remove(eventId: string, personId: string): Promise<void>;
  findByEvent(eventId: string): Promise<Person[]>;
}

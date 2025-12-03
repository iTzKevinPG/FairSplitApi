import { Injectable } from '@nestjs/common';
import { ParticipantRepository } from '../../application/ports/participant-repository';
import { Person } from '../../domain/person/person';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaParticipantRepository implements ParticipantRepository {
  constructor(private readonly _prisma: PrismaService) {}

  async add(eventId: string, person: Person): Promise<Person> {
    const created = await this._prisma.person.create({
      data: {
        id: person.id,
        name: person.name,
        eventId,
      },
    });
    return new Person(created.id, created.name);
  }

  async update(eventId: string, person: Person): Promise<Person> {
    const updated = await this._prisma.person.update({
      where: { id: person.id, eventId },
      data: { name: person.name },
    });
    return new Person(updated.id, updated.name);
  }

  async remove(eventId: string, personId: string): Promise<void> {
    await this._prisma.person.delete({
      where: { id: personId, eventId },
    });
  }

  async findById(eventId: string, personId: string): Promise<Person | null> {
    const found = await this._prisma.person.findFirst({
      where: { id: personId, eventId },
    });
    return found ? new Person(found.id, found.name) : null;
  }

  async findByEvent(eventId: string): Promise<Person[]> {
    const persons = await this._prisma.person.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
    });
    return persons.map((p) => new Person(p.id, p.name));
  }

  async hasInvoices(eventId: string, personId: string): Promise<boolean> {
    const [payerCount, participationCount] = await Promise.all([
      this._prisma.invoice.count({
        where: {
          eventId,
          payerId: personId,
        },
      }),
      this._prisma.participation.count({
        where: {
          personId,
          invoice: { eventId },
        },
      }),
    ]);
    return payerCount > 0 || participationCount > 0;
  }
}

import { Injectable } from '@nestjs/common';
import { EventRepository } from '../../application/ports/event-repository';
import { Event } from '../../domain/event/event';
import { EventId } from '../../domain/event/event-id';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaEventRepository implements EventRepository {
  constructor(private readonly _prisma: PrismaService) {}

  async create(input: { name: string; currency: string; userId: string }): Promise<Event> {
    const created = await this._prisma.event.create({
      data: {
        name: input.name,
        currency: input.currency,
        userId: input.userId,
      },
    });
    return new Event(created.id, created.name, created.currency, created.createdAt);
  }

  async findByIdForUser(id: EventId, userId: string): Promise<Event | null> {
    const event = await this._prisma.event.findFirst({ where: { id, userId } });
    return event ? new Event(event.id, event.name, event.currency, event.createdAt) : null;
  }

  async findAllByUser(userId: string): Promise<Event[]> {
    const events = await this._prisma.event.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return events.map((event) => new Event(event.id, event.name, event.currency, event.createdAt));
  }
}

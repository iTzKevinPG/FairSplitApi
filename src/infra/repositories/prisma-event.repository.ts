import { Injectable } from '@nestjs/common';
import { EventRepository } from '../../application/ports/event-repository';
import type { EventSummaryDTO } from '../../application/dto/EventSummaryDTO';
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

  async findById(id: EventId): Promise<Event | null> {
    const event = await this._prisma.event.findUnique({ where: { id } });
    return event ? new Event(event.id, event.name, event.currency, event.createdAt) : null;
  }

  async findByIdForUser(id: EventId, userId: string): Promise<Event | null> {
    const event = await this._prisma.event.findFirst({ where: { id, userId } });
    return event ? new Event(event.id, event.name, event.currency, event.createdAt) : null;
  }

  async findAllByUser(userId: string): Promise<EventSummaryDTO[]> {
    const events = await this._prisma.event.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        currency: true,
        _count: {
          select: {
            participants: true,
            invoices: true,
          },
        },
      },
    });
    return events.map((event) => ({
      id: event.id,
      name: event.name,
      currency: event.currency,
      peopleCount: event._count.participants,
      invoiceCount: event._count.invoices,
    }));
  }

  async deleteForUser(id: EventId, userId: string): Promise<boolean> {
    const result = await this._prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({ where: { id, userId } });
      if (!event) return false;

      await tx.participation.deleteMany({
        where: {
          invoice: {
            eventId: id,
          },
        },
      });
      await tx.invoice.deleteMany({ where: { eventId: id } });
      await tx.person.deleteMany({ where: { eventId: id } });
      await tx.transferStatus.deleteMany({ where: { eventId: id } });
      await tx.event.delete({ where: { id } });
      return true;
    });

    return result;
  }
}

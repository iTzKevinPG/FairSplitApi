import { Injectable } from '@nestjs/common';
import { EventRepository } from '../../application/ports/EventRepository';
import { Event } from '../../domain/event/Event';
import { EventId } from '../../domain/event/EventId';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaEventRepository implements EventRepository {
  constructor(private readonly _prisma: PrismaService) {}

  async create(_event: Event): Promise<Event> {
    throw new Error('Method not implemented.');
  }

  async findById(_id: EventId): Promise<Event | null> {
    throw new Error('Method not implemented.');
  }

  async findAll(): Promise<Event[]> {
    throw new Error('Method not implemented.');
  }
}

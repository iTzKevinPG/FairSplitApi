import { Injectable } from '@nestjs/common';
import { ParticipantRepository } from '../../application/ports/ParticipantRepository';
import { Person } from '../../domain/person/Person';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaParticipantRepository implements ParticipantRepository {
  constructor(private readonly _prisma: PrismaService) {}

  async add(_eventId: string, _person: Person): Promise<Person> {
    throw new Error('Method not implemented.');
  }

  async update(_eventId: string, _person: Person): Promise<Person> {
    throw new Error('Method not implemented.');
  }

  async remove(_eventId: string, _personId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async findByEvent(_eventId: string): Promise<Person[]> {
    throw new Error('Method not implemented.');
  }
}

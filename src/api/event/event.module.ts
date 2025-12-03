import { Module } from '@nestjs/common';
import { CreateEventUseCase } from '../../application/use-cases/create-event.use-case';
import { GetEventUseCase } from '../../application/use-cases/get-event.use-case';
import { ListEventsUseCase } from '../../application/use-cases/list-events.use-case';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { PrismaEventRepository } from '../../infra/repositories/prisma-event.repository';
import { EventController } from './event.controller';

@Module({
  imports: [PrismaModule],
  controllers: [EventController],
  providers: [
    CreateEventUseCase,
    ListEventsUseCase,
    GetEventUseCase,
    {
      provide: 'EventRepository',
      useClass: PrismaEventRepository,
    },
  ],
})
export class EventModule {}

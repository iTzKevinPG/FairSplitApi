import { Module } from '@nestjs/common';
import { CreateEventUseCase } from '../../application/use-cases/create-event.use-case';
import { GetEventUseCase } from '../../application/use-cases/get-event.use-case';
import { ListEventsUseCase } from '../../application/use-cases/list-events.use-case';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { PrismaEventRepository } from '../../infra/repositories/prisma-event.repository';
import { EventController } from './event.controller';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { RemoveEventUseCase } from '../../application/use-cases/remove-event.use-case';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EventController],
  providers: [
    CreateEventUseCase,
    ListEventsUseCase,
    GetEventUseCase,
    RemoveEventUseCase,
    AuthGuard,
    {
      provide: 'EventRepository',
      useClass: PrismaEventRepository,
    },
  ],
})
export class EventModule {}

import { Module } from '@nestjs/common';
import { AddParticipantUseCase } from '../../application/use-cases/add-participant.use-case';
import { ListParticipantsUseCase } from '../../application/use-cases/list-participants.use-case';
import { RemoveParticipantUseCase } from '../../application/use-cases/remove-participant.use-case';
import { UpdateParticipantUseCase } from '../../application/use-cases/update-participant.use-case';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { PrismaEventRepository } from '../../infra/repositories/prisma-event.repository';
import { PrismaParticipantRepository } from '../../infra/repositories/prisma-participant.repository';
import { ParticipantController } from './participant.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ParticipantController],
  providers: [
    AddParticipantUseCase,
    ListParticipantsUseCase,
    UpdateParticipantUseCase,
    RemoveParticipantUseCase,
    {
      provide: 'ParticipantRepository',
      useClass: PrismaParticipantRepository,
    },
    {
      provide: 'EventRepository',
      useClass: PrismaEventRepository,
    },
  ],
})
export class ParticipantModule {}

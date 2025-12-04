import { Module } from '@nestjs/common';
import { GetEventFullSummaryUseCase } from '../../application/use-cases/get-event-full-summary.use-case';
import { GetEventSummaryUseCase } from '../../application/use-cases/get-event-summary.use-case';
import { GetEventTransfersUseCase } from '../../application/use-cases/get-event-transfers.use-case';
import { ListInvoicesUseCase } from '../../application/use-cases/list-invoices.use-case';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { PrismaEventRepository } from '../../infra/repositories/prisma-event.repository';
import { PrismaInvoiceRepository } from '../../infra/repositories/prisma-invoice.repository';
import { PrismaParticipantRepository } from '../../infra/repositories/prisma-participant.repository';
import { SettlementController } from './settlement.controller';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../../shared/guards/auth.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SettlementController],
  providers: [
    GetEventFullSummaryUseCase,
    GetEventSummaryUseCase,
    GetEventTransfersUseCase,
    ListInvoicesUseCase,
    AuthGuard,
    {
      provide: 'InvoiceRepository',
      useClass: PrismaInvoiceRepository,
    },
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
export class SettlementModule {}

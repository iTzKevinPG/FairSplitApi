import { Module } from '@nestjs/common';
import { GetEventFullSummaryUseCase } from '../../application/use-cases/get-event-full-summary.use-case';
import { GetEventSummaryUseCase } from '../../application/use-cases/get-event-summary.use-case';
import { GetEventTransfersUseCase } from '../../application/use-cases/get-event-transfers.use-case';
import { GetTransferStatusUseCase } from '../../application/use-cases/get-transfer-status.use-case';
import { ListInvoicesUseCase } from '../../application/use-cases/list-invoices.use-case';
import { GetPublicEventOverviewUseCase } from '../../application/use-cases/get-public-event-overview.use-case';
import { UpsertTransferStatusUseCase } from '../../application/use-cases/upsert-transfer-status.use-case';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { PrismaEventRepository } from '../../infra/repositories/prisma-event.repository';
import { PrismaInvoiceRepository } from '../../infra/repositories/prisma-invoice.repository';
import { PrismaParticipantRepository } from '../../infra/repositories/prisma-participant.repository';
import { PrismaTransferStatusRepository } from '../../infra/repositories/prisma-transfer-status.repository';
import { PublicSettlementController } from './public-settlement.controller';
import { SettlementController } from './settlement.controller';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../../shared/guards/auth.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SettlementController, PublicSettlementController],
  providers: [
    GetEventFullSummaryUseCase,
    GetEventSummaryUseCase,
    GetEventTransfersUseCase,
    GetTransferStatusUseCase,
    ListInvoicesUseCase,
    GetPublicEventOverviewUseCase,
    UpsertTransferStatusUseCase,
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
    {
      provide: 'TransferStatusRepository',
      useClass: PrismaTransferStatusRepository,
    },
  ],
})
export class SettlementModule {}

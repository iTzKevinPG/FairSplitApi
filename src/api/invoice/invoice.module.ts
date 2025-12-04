import { Module } from '@nestjs/common';
import { CreateInvoiceUseCase } from '../../application/use-cases/create-invoice.use-case';
import { GetInvoiceUseCase } from '../../application/use-cases/get-invoice.use-case';
import { ListInvoicesUseCase } from '../../application/use-cases/list-invoices.use-case';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { PrismaEventRepository } from '../../infra/repositories/prisma-event.repository';
import { PrismaInvoiceRepository } from '../../infra/repositories/prisma-invoice.repository';
import { PrismaParticipantRepository } from '../../infra/repositories/prisma-participant.repository';
import { InvoiceController } from './invoice.controller';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../../shared/guards/auth.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [InvoiceController],
  providers: [
    CreateInvoiceUseCase,
    ListInvoicesUseCase,
    GetInvoiceUseCase,
    AuthGuard,
    {
      provide: 'InvoiceRepository',
      useClass: PrismaInvoiceRepository,
    },
    {
      provide: 'EventRepository',
      useClass: PrismaEventRepository,
    },
    {
      provide: 'ParticipantRepository',
      useClass: PrismaParticipantRepository,
    },
  ],
})
export class InvoiceModule {}

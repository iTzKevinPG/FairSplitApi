import { Module } from '@nestjs/common';
import { CreateInvoiceUseCase } from '../../application/use-cases/create-invoice.use-case';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { PrismaEventRepository } from '../../infra/repositories/prisma-event.repository';
import { PrismaInvoiceRepository } from '../../infra/repositories/prisma-invoice.repository';
import { PrismaParticipantRepository } from '../../infra/repositories/prisma-participant.repository';
import { InvoiceController } from './invoice.controller';

@Module({
  imports: [PrismaModule],
  controllers: [InvoiceController],
  providers: [
    CreateInvoiceUseCase,
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

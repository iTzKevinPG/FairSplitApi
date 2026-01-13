import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { INVOICE_SCAN_QUEUE } from './invoice-scan.constants';
import { InvoiceScanController } from './invoice-scan.controller';
import { InvoiceScanService } from './invoice-scan.service';
import { InvoiceScanProcessor } from './invoice-scan.processor';
import { S3Service } from '../../infra/storage/s3.service';
import { InvoiceScanRateLimitService } from './invoice-scan-rate-limit.service';
import { InvoiceScanResultService } from './invoice-scan-result.service';
import { AuthModule } from '../auth/auth.module';
import { OptionalAuthGuard } from '../../shared/guards/optional-auth.guard';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { PrismaEventRepository } from '../../infra/repositories/prisma-event.repository';
import { PrismaInvoiceRepository } from '../../infra/repositories/prisma-invoice.repository';
import { PrismaParticipantRepository } from '../../infra/repositories/prisma-participant.repository';
import { CreateInvoiceUseCase } from '../../application/use-cases/create-invoice.use-case';

@Module({
  imports: [BullModule.registerQueue({ name: INVOICE_SCAN_QUEUE }), AuthModule, PrismaModule],
  controllers: [InvoiceScanController],
  providers: [
    InvoiceScanService,
    InvoiceScanProcessor,
    S3Service,
    InvoiceScanRateLimitService,
    InvoiceScanResultService,
    CreateInvoiceUseCase,
    OptionalAuthGuard,
    {
      provide: 'EventRepository',
      useClass: PrismaEventRepository,
    },
    {
      provide: 'InvoiceRepository',
      useClass: PrismaInvoiceRepository,
    },
    {
      provide: 'ParticipantRepository',
      useClass: PrismaParticipantRepository,
    },
  ],
})
export class InvoiceScanModule {}

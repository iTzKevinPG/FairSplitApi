import { Module } from '@nestjs/common';
import { EventModule } from './api/event/event.module';
import { ParticipantModule } from './api/participant/participant.module';
import { InvoiceModule } from './api/invoice/invoice.module';
import { SettlementModule } from './api/settlement/settlement.module';

@Module({
  imports: [EventModule, ParticipantModule, InvoiceModule, SettlementModule],
})
export class AppModule {}

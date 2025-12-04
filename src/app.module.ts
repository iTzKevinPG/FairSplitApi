import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { EventModule } from './api/event/event.module';
import { ParticipantModule } from './api/participant/participant.module';
import { InvoiceModule } from './api/invoice/invoice.module';
import { SettlementModule } from './api/settlement/settlement.module';
import { AuthModule } from './api/auth/auth.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    AuthModule,
    EventModule,
    ParticipantModule,
    InvoiceModule,
    SettlementModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

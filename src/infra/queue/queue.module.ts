import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

const redisUrl = process.env.REDIS_URL;
const connection = redisUrl ? { url: redisUrl } : { host: '127.0.0.1', port: 6379 };

@Module({
  imports: [
    BullModule.forRoot({
      connection,
    }),
  ],
})
export class QueueModule {}

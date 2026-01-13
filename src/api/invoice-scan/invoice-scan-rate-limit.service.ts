import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class InvoiceScanRateLimitService {
  private readonly _redis: Redis;
  constructor() {
    const redisUrl = process.env.REDIS_URL;
    this._redis = redisUrl ? new Redis(redisUrl) : new Redis();
  }

  async assertWithinLimit(params: {
    keyId: string;
    limit: number;
    period: 'month' | 'day';
    scope?: 'guest' | 'user';
  }) {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const suffix = params.period === 'day' ? `${year}-${month}-${day}` : `${year}-${month}`;
    const key =
      params.period === 'day'
        ? `invoice_scan_daily:${params.keyId}:${suffix}`
        : `invoice_scan_count:${params.keyId}:${suffix}`;
    const count = await this._redis.incr(key);

    if (count === 1) {
      const expireAt =
        params.period === 'day'
          ? new Date(Date.UTC(year, now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))
          : new Date(Date.UTC(year, now.getUTCMonth() + 1, 1, 0, 0, 0));
      const expireAtSeconds = Math.floor(expireAt.getTime() / 1000);
      await this._redis.expireat(key, expireAtSeconds);
    }

    if (count > params.limit) {
      const scopeLabel = params.scope === 'guest' ? 'Guest' : 'User';
      const periodLabel = params.period === 'day' ? 'daily' : 'monthly';
      throw new HttpException(
        {
          code: 'SCAN_LIMIT_REACHED',
          message: `${scopeLabel} OCR ${periodLabel} limit reached`,
          limit: params.limit,
          period: params.period,
          scope: params.scope ?? 'user',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}

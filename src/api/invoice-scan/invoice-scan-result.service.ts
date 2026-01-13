import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

const DEFAULT_TTL_SECONDS = 60 * 60 * 48;

@Injectable()
export class InvoiceScanResultService {
  private readonly _redis: Redis;
  private readonly _ttlSeconds: number;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    this._redis = redisUrl ? new Redis(redisUrl) : new Redis();
    this._ttlSeconds = Number(process.env.INVOICE_SCAN_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
  }

  private buildKey(jobId: string) {
    return `invoice_scan_result:${jobId}`;
  }

  async set(jobId: string, payload: unknown) {
    const key = this.buildKey(jobId);
    await this._redis.set(key, JSON.stringify(payload), 'EX', this._ttlSeconds);
  }

  async get(jobId: string) {
    const key = this.buildKey(jobId);
    const raw = await this._redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
}

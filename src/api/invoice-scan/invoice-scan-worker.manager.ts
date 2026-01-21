import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'bullmq';
import { INVOICE_SCAN_QUEUE } from './invoice-scan.constants';
import { InvoiceScanProcessor } from './invoice-scan.processor';

const redisUrl = process.env.REDIS_URL;
const connection = redisUrl ? { url: redisUrl } : { host: '127.0.0.1', port: 6379 };

@Injectable()
export class InvoiceScanWorkerManager implements OnModuleDestroy {
  private readonly _log = new Logger(InvoiceScanWorkerManager.name);
  private _worker?: Worker;
  private _idleTimer?: NodeJS.Timeout;

  constructor(private readonly _processor: InvoiceScanProcessor) {}

  async ensureRunning() {
    if (this._worker) {
      this._clearIdleTimer();
      return;
    }

    this._worker = new Worker(
      INVOICE_SCAN_QUEUE,
      (job) => this._processor.process(job),
      {
        connection,
        concurrency: Number(process.env.INVOICE_SCAN_WORKER_CONCURRENCY ?? 1),
        drainDelay: Number(process.env.INVOICE_SCAN_DRAIN_DELAY_SECONDS ?? 30),
      },
    );

    this._worker.on('active', () => this._clearIdleTimer());
    this._worker.on('drained', () => this._scheduleShutdown());
    this._worker.on('failed', (job, err) => {
      this._log.warn(`invoice_scan_worker_failed job=${job?.id} message=${err?.message}`);
      this._scheduleShutdown();
    });
  }

  private _scheduleShutdown() {
    const idleMs = Number(process.env.INVOICE_SCAN_IDLE_SHUTDOWN_MS ?? 60000);
    if (idleMs <= 0) return;
    this._clearIdleTimer();
    this._idleTimer = setTimeout(() => {
      this.stopWorker().catch((err) => {
        this._log.warn(`invoice_scan_worker_stop_failed ${err?.message ?? err}`);
      });
    }, idleMs);
    this._idleTimer.unref();
  }

  private _clearIdleTimer() {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = undefined;
    }
  }

  async stopWorker() {
    this._clearIdleTimer();
    if (!this._worker) return;
    const worker = this._worker;
    this._worker = undefined;
    await worker.close();
  }

  async onModuleDestroy() {
    await this.stopWorker();
  }
}

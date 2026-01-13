import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { INVOICE_SCAN_JOB, INVOICE_SCAN_QUEUE } from './invoice-scan.constants';
import { InvoiceScanResultService } from './invoice-scan-result.service';
import { CreateInvoiceUseCase } from '../../application/use-cases/create-invoice.use-case';
import type { ConfirmScanDto } from './dto/confirm-scan.dto';

type ScanJobData = {
  eventId: string;
  userId: string;
  imageKey: string;
  contentType: string;
  eventCurrency?: string;
};

@Injectable()
export class InvoiceScanService {
  constructor(
    @InjectQueue(INVOICE_SCAN_QUEUE) private readonly _queue: Queue,
    private readonly _results: InvoiceScanResultService,
    private readonly _createInvoice: CreateInvoiceUseCase,
  ) {}

  async enqueueScan(params: ScanJobData) {
    const job = await this._queue.add(
      INVOICE_SCAN_JOB,
      params,
      { removeOnComplete: 25, removeOnFail: 25 },
    );
    return { jobId: job.id?.toString() ?? job.id };
  }

  async getScanStatus(jobId: string, userId?: string) {
    const job = await this._queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException({ code: 'SCAN_NOT_FOUND', message: 'Scan job not found' });
    }
    if (userId) {
      const jobUserId = (job.data as { userId?: string } | undefined)?.userId;
      if (jobUserId && jobUserId !== userId) {
        throw new NotFoundException({ code: 'SCAN_NOT_FOUND', message: 'Scan job not found' });
      }
    }
    const state = await job.getState();
    const progressValue = job.progress;
    const cached = await this._results.get(jobId);
    const response: {
      jobId: string;
      status: string;
      progress?: number;
      result?: unknown;
      failedReason?: string;
    } = {
      jobId,
      status: state,
    };
    if (typeof progressValue === 'number') {
      response.progress = progressValue;
    }
    if (cached) {
      response.result = cached;
    } else if (state === 'completed') {
      response.result = job.returnvalue ?? null;
    }
    if (state === 'failed') {
      response.failedReason = job.failedReason;
    }
    return response;
  }

  async confirmScan(jobId: string, userId: string, input: ConfirmScanDto) {
    const cached = await this._results.get(jobId);
    if (!cached) {
      throw new NotFoundException({ code: 'SCAN_EXPIRED', message: 'Scan result expired' });
    }
    const cachedEventId = (cached as { meta?: { eventId?: string } } | null)?.meta?.eventId;
    if (cachedEventId && cachedEventId !== input.eventId) {
      throw new BadRequestException({
        code: 'SCAN_EVENT_MISMATCH',
        message: 'Scan does not belong to event',
      });
    }

    return this._createInvoice.execute({
      eventId: input.eventId,
      description: input.description,
      totalAmount: input.totalAmount,
      payerId: input.payerId,
      participantIds: input.participantIds,
      divisionMethod: input.divisionMethod,
      consumptions: input.consumptions,
      items: input.items,
      tipAmount: input.tipAmount,
      birthdayPersonId: input.birthdayPersonId,
      userId,
    });
  }

  async retryScan(jobId: string, userId?: string) {
    const job = await this._queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException({ code: 'SCAN_NOT_FOUND', message: 'Scan job not found' });
    }
    if (userId) {
      const jobUserId = (job.data as { userId?: string } | undefined)?.userId;
      if (jobUserId && jobUserId !== userId) {
        throw new NotFoundException({ code: 'SCAN_NOT_FOUND', message: 'Scan job not found' });
      }
    }
    const state = await job.getState();
    if (state !== 'failed') {
      throw new BadRequestException({
        code: 'SCAN_NOT_FAILED',
        message: 'Scan is not in failed state',
      });
    }

    const data = job.data as {
      eventId: string;
      userId: string;
      imageKey: string;
      contentType: string;
    };
    const next = await this._queue.add(INVOICE_SCAN_JOB, data, {
      removeOnComplete: 25,
      removeOnFail: 25,
    });
    return { jobId: next.id?.toString() ?? next.id };
  }
}

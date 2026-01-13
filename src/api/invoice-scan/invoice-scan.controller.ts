import {
  BadRequestException,
  Controller,
  Body,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { createHash } from 'crypto';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { InvoiceScanService } from './invoice-scan.service';
import { S3Service } from '../../infra/storage/s3.service';
import { InvoiceScanRateLimitService } from './invoice-scan-rate-limit.service';
import { OptionalAuthGuard } from '../../shared/guards/optional-auth.guard';
import type { EventRepository } from '../../application/ports/event-repository';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { ConfirmScanDto } from './dto/confirm-scan.dto';

@UseGuards(OptionalAuthGuard)
@Controller()
export class InvoiceScanController {
  constructor(
    private readonly _scanService: InvoiceScanService,
    private readonly _s3Service: S3Service,
    private readonly _rateLimit: InvoiceScanRateLimitService,
    @Inject('EventRepository') private readonly _eventRepository: EventRepository,
  ) {}

  @Post('events/:eventId/invoices/scan')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowed.includes(file.mimetype)) {
          return cb(new BadRequestException('Unsupported file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  async scanInvoice(
    @Param('eventId') eventId: string,
    @CurrentUser() user: { id: string } | undefined,
    @UploadedFile() file?: Express.Multer.File,
    @Req() request?: { headers?: Record<string, string | string[]>; ip?: string },
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const userId = user?.id;
    let eventCurrency: string | undefined;
    if (userId) {
      const event = await this._eventRepository.findByIdForUser(eventId, userId);
      if (!event) {
        throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
      }
      eventCurrency = event.currency;
    }

    const rateKey = userId ?? this.buildIpKey(request);
    if (userId) {
      const monthlyLimit = Number(process.env.USER_OCR_MONTHLY_LIMIT ?? 100);
      await this._rateLimit.assertWithinLimit({
        keyId: rateKey,
        limit: monthlyLimit,
        period: 'month',
        scope: 'user',
      });
    } else {
      const guestMonthlyLimit = Number(process.env.GUEST_OCR_MONTHLY_LIMIT ?? 50);
      const guestDailyLimit = Number(process.env.GUEST_OCR_DAILY_LIMIT ?? 0);
      if (guestDailyLimit > 0) {
        await this._rateLimit.assertWithinLimit({
          keyId: rateKey,
          limit: guestDailyLimit,
          period: 'day',
          scope: 'guest',
        });
      }
      await this._rateLimit.assertWithinLimit({
        keyId: rateKey,
        limit: guestMonthlyLimit,
        period: 'month',
        scope: 'guest',
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ownerSegment = userId ?? `guest-${rateKey}`;
    const key = `invoice-scans/${ownerSegment}/${eventId}/${timestamp}-${safeName}`;

    await this._s3Service.uploadBuffer({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    return this._scanService.enqueueScan({
      eventId,
      userId: userId ?? `guest:${rateKey}`,
      imageKey: key,
      contentType: file.mimetype,
      eventCurrency,
    });
  }

  @Post('invoices/scan/:jobId/rescan')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowed.includes(file.mimetype)) {
          return cb(new BadRequestException('Unsupported file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  async rescanInvoice(
    @Param('jobId') jobId: string,
    @Body('eventId') eventId: string,
    @CurrentUser() user: { id: string } | undefined,
    @UploadedFile() file?: Express.Multer.File,
    @Req() request?: { headers?: Record<string, string | string[]>; ip?: string },
  ) {
    void jobId;
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!eventId) {
      throw new BadRequestException('Event id is required');
    }
    const userId = user?.id;
    let eventCurrency: string | undefined;
    if (userId) {
      const event = await this._eventRepository.findByIdForUser(eventId, userId);
      if (!event) {
        throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
      }
      eventCurrency = event.currency;
    }

    const rateKey = userId ?? this.buildIpKey(request);
    if (userId) {
      const monthlyLimit = Number(process.env.USER_OCR_MONTHLY_LIMIT ?? 100);
      await this._rateLimit.assertWithinLimit({
        keyId: rateKey,
        limit: monthlyLimit,
        period: 'month',
        scope: 'user',
      });
    } else {
      const guestMonthlyLimit = Number(process.env.GUEST_OCR_MONTHLY_LIMIT ?? 50);
      const guestDailyLimit = Number(process.env.GUEST_OCR_DAILY_LIMIT ?? 0);
      if (guestDailyLimit > 0) {
        await this._rateLimit.assertWithinLimit({
          keyId: rateKey,
          limit: guestDailyLimit,
          period: 'day',
          scope: 'guest',
        });
      }
      await this._rateLimit.assertWithinLimit({
        keyId: rateKey,
        limit: guestMonthlyLimit,
        period: 'month',
        scope: 'guest',
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ownerSegment = userId ?? `guest-${rateKey}`;
    const key = `invoice-scans/${ownerSegment}/${eventId}/${timestamp}-${safeName}`;

    await this._s3Service.uploadBuffer({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    return this._scanService.enqueueScan({
      eventId,
      userId: userId ?? `guest:${rateKey}`,
      imageKey: key,
      contentType: file.mimetype,
      eventCurrency,
    });
  }

  @Get('invoices/scan/:jobId')
  async getScanStatus(
    @Param('jobId') jobId: string,
    @CurrentUser() user: { id: string } | undefined,
  ) {
    return this._scanService.getScanStatus(jobId, user?.id);
  }

  @Post('invoices/scan/:jobId/confirm')
  @UseGuards(AuthGuard)
  async confirmScan(
    @Param('jobId') jobId: string,
    @Body() body: ConfirmScanDto,
    @CurrentUser() user: { id: string },
  ) {
    return this._scanService.confirmScan(jobId, user.id, body);
  }

  @Post('invoices/scan/:jobId/retry')
  async retryScan(@Param('jobId') jobId: string, @CurrentUser() user: { id: string } | undefined) {
    return this._scanService.retryScan(jobId, user?.id);
  }

  private buildIpKey(request?: { headers?: Record<string, string | string[]>; ip?: string }) {
    const forwarded = request?.headers?.['x-forwarded-for'];
    const raw =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() ??
      request?.ip ??
      'unknown';
    return createHash('sha256').update(raw).digest('hex').slice(0, 32);
  }
}

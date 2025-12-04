import { Controller, Get, Param } from '@nestjs/common';
import { GetEventFullSummaryUseCase } from '../../application/use-cases/get-event-full-summary.use-case';
import { GetEventSummaryUseCase } from '../../application/use-cases/get-event-summary.use-case';
import { GetEventTransfersUseCase } from '../../application/use-cases/get-event-transfers.use-case';

@Controller('events/:eventId')
export class SettlementController {
  constructor(
    private readonly _getEventSummary: GetEventSummaryUseCase,
    private readonly _getEventTransfers: GetEventTransfersUseCase,
    private readonly _getEventFullSummary: GetEventFullSummaryUseCase,
  ) {}

  @Get('summary')
  async getSummary(@Param('eventId') eventId: string) {
    return this._getEventSummary.execute(eventId);
  }

  @Get('transfers')
  async getTransfers(@Param('eventId') eventId: string) {
    return this._getEventTransfers.execute(eventId);
  }

  @Get('full-summary')
  async getFullSummary(@Param('eventId') eventId: string) {
    return this._getEventFullSummary.execute(eventId);
  }
}

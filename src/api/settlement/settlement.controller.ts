import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GetEventFullSummaryUseCase } from '../../application/use-cases/get-event-full-summary.use-case';
import { GetEventSummaryUseCase } from '../../application/use-cases/get-event-summary.use-case';
import { GetEventTransfersUseCase } from '../../application/use-cases/get-event-transfers.use-case';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';

@Controller('events/:eventId')
@UseGuards(AuthGuard)
export class SettlementController {
  constructor(
    private readonly _getEventSummary: GetEventSummaryUseCase,
    private readonly _getEventTransfers: GetEventTransfersUseCase,
    private readonly _getEventFullSummary: GetEventFullSummaryUseCase,
  ) {}

  @Get('summary')
  async getSummary(@Param('eventId') eventId: string, @CurrentUser() user: { id: string }) {
    return this._getEventSummary.execute(eventId, user.id);
  }

  @Get('transfers')
  async getTransfers(@Param('eventId') eventId: string, @CurrentUser() user: { id: string }) {
    return this._getEventTransfers.execute(eventId, user.id);
  }

  @Get('full-summary')
  async getFullSummary(
    @Param('eventId') eventId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this._getEventFullSummary.execute(eventId, user.id);
  }
}

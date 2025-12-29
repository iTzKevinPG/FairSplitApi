import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { GetEventFullSummaryUseCase } from '../../application/use-cases/get-event-full-summary.use-case';
import { GetEventSummaryUseCase } from '../../application/use-cases/get-event-summary.use-case';
import { GetEventTransfersUseCase } from '../../application/use-cases/get-event-transfers.use-case';
import { GetTransferStatusUseCase } from '../../application/use-cases/get-transfer-status.use-case';
import { UpsertTransferStatusUseCase } from '../../application/use-cases/upsert-transfer-status.use-case';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';

type TransferStatusPayload = {
  fromParticipantId: string;
  toParticipantId: string;
  isSettled: boolean;
};

@Controller('events/:eventId')
@UseGuards(AuthGuard)
export class SettlementController {
  constructor(
    private readonly _getEventSummary: GetEventSummaryUseCase,
    private readonly _getEventTransfers: GetEventTransfersUseCase,
    private readonly _getEventFullSummary: GetEventFullSummaryUseCase,
    private readonly _getTransferStatus: GetTransferStatusUseCase,
    private readonly _upsertTransferStatus: UpsertTransferStatusUseCase,
  ) {}

  @Get('summary')
  async getSummary(@Param('eventId') eventId: string, @CurrentUser() user: { id: string }) {
    return this._getEventSummary.execute(eventId, user.id);
  }

  @Get('transfers')
  async getTransfers(@Param('eventId') eventId: string, @CurrentUser() user: { id: string }) {
    return this._getEventTransfers.execute(eventId, user.id);
  }

  @Get('transfer-status')
  async getTransferStatus(
    @Param('eventId') eventId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this._getTransferStatus.execute(eventId, user.id);
  }

  @Put('transfer-status')
  async upsertTransferStatus(
    @Param('eventId') eventId: string,
    @Body() payload: TransferStatusPayload,
    @CurrentUser() user: { id: string },
  ) {
    return this._upsertTransferStatus.execute({
      eventId,
      userId: user.id,
      fromParticipantId: payload.fromParticipantId,
      toParticipantId: payload.toParticipantId,
      isSettled: payload.isSettled,
    });
  }

  @Get('full-summary')
  async getFullSummary(
    @Param('eventId') eventId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this._getEventFullSummary.execute(eventId, user.id);
  }
}

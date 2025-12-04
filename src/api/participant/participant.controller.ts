import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AddParticipantUseCase } from '../../application/use-cases/add-participant.use-case';
import { ListParticipantsUseCase } from '../../application/use-cases/list-participants.use-case';
import { RemoveParticipantUseCase } from '../../application/use-cases/remove-participant.use-case';
import { UpdateParticipantUseCase } from '../../application/use-cases/update-participant.use-case';
import { Person } from '../../domain/person/person';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';

@Controller('events/:eventId/participants')
@UseGuards(AuthGuard)
export class ParticipantController {
  constructor(
    private readonly _addParticipant: AddParticipantUseCase,
    private readonly _listParticipants: ListParticipantsUseCase,
    private readonly _updateParticipant: UpdateParticipantUseCase,
    private readonly _removeParticipant: RemoveParticipantUseCase,
  ) {}

  @Get()
  async list(
    @Param('eventId') eventId: string,
    @CurrentUser() user: { id: string },
  ): Promise<Person[]> {
    return this._listParticipants.execute(eventId, user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('eventId') eventId: string,
    @Body() body: CreateParticipantDto,
    @CurrentUser() user: { id: string },
  ): Promise<Person> {
    return this._addParticipant.execute({ eventId, name: body.name, userId: user.id });
  }

  @Patch(':participantId')
  async update(
    @Param('eventId') eventId: string,
    @Param('participantId') participantId: string,
    @Body() body: UpdateParticipantDto,
    @CurrentUser() user: { id: string },
  ): Promise<Person> {
    return this._updateParticipant.execute({
      eventId,
      participantId,
      name: body.name,
      userId: user.id,
    });
  }

  @Delete(':participantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('eventId') eventId: string,
    @Param('participantId') participantId: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    await this._removeParticipant.execute({ eventId, participantId, userId: user.id });
  }
}

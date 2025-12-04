import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthCodeService } from '../../application/services/auth-code.service';
import { RequestCodeDto } from './dto/request-code.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly _authCode: AuthCodeService) {}

  @Post('request-code')
  @HttpCode(HttpStatus.OK)
  async requestCode(@Body() body: RequestCodeDto) {
    const normalizedEmail = body.email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        fieldErrors: { email: 'Email is required' },
      });
    }

    await this._authCode.sendCode(normalizedEmail);
    return { message: 'Code sent' };
  }
}

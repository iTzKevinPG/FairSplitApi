import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthCodeService } from '../../application/services/auth-code.service';
import { AuthService } from '../../application/services/auth.service';
import { RequestCodeDto } from './dto/request-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly _authCode: AuthCodeService,
    private readonly _authService: AuthService,
  ) {}

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

  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  async verifyCode(@Body() body: VerifyCodeDto) {
    const email = body.email.trim().toLowerCase();
    const code = body.code.trim();
    const isValid = this._authCode.verifyCode(email, code);
    if (!isValid) {
      throw new BadRequestException({
        code: 'INVALID_CODE',
        message: 'Código inválido o expirado',
      });
    }

    const result = await this._authService.ensureUserAndIssueToken(email);
    return result;
  }
}

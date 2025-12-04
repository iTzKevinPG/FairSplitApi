import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthCodeService } from '../../application/services/auth-code.service';

@Module({
  controllers: [AuthController],
  providers: [AuthCodeService],
})
export class AuthModule {}

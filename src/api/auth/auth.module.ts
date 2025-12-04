import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthCodeService } from '../../application/services/auth-code.service';
import { AuthService } from '../../application/services/auth.service';
import { PrismaModule } from '../../infra/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthCodeService, AuthService],
  exports: [AuthService],
})
export class AuthModule {}

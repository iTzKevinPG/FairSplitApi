import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../application/services/auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly _authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid token',
      });
    }
    const token = authHeader.slice(7).trim();
    const user = await this._authService.authenticate(token);
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    }
    request.user = { id: user.id, email: user.email };
    return true;
  }
}

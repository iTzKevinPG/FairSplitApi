import { Injectable } from '@nestjs/common';
import { randomUUID, createHmac } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';

type AuthResult = {
  token: string;
  user: {
    id: string;
    email: string;
  };
};

@Injectable()
export class AuthService {
  constructor(private readonly _prisma: PrismaService) {}

  async ensureUserAndIssueToken(email: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    let user = await this._prisma.user.findUnique({ where: { email: normalizedEmail } });
    const now = new Date();
    if (!user) {
      user = await this._prisma.user.create({
        data: {
          id: randomUUID(),
          email: normalizedEmail,
          verifiedAt: now,
        },
      });
    } else if (!user.verifiedAt) {
      user = await this._prisma.user.update({
        where: { id: user.id },
        data: { verifiedAt: now },
      });
    }

    const token = this.signToken(user.id, normalizedEmail);
    return {
      token,
      user: { id: user.id, email: user.email },
    };
  }

  private signToken(userId: string, email: string): string {
    const secret = process.env.AUTH_SECRET || 'dev-auth-secret';
    const now = Date.now();
    const payloadObj = { userId, email, iat: now, exp: now + 60 * 60 * 1000 };
    const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    return `${payload}.${signature}`;
  }

  async authenticate(token: string): Promise<{ id: string; email: string } | null> {
    try {
      const parts = token.split('.');
      if (parts.length !== 2) return null;
      const [payload, signature] = parts;
      const secret = process.env.AUTH_SECRET || 'dev-auth-secret';
      const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');
      if (signature !== expectedSignature) return null;

      const decoded = Buffer.from(payload, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded) as {
        userId?: string;
        email?: string;
        iat?: number;
        exp?: number;
      };
      if (!parsed.userId || !parsed.email) return null;
      if (typeof parsed.exp === 'number' && Date.now() > parsed.exp) return null;

      const user = await this._prisma.user.findUnique({ where: { id: parsed.userId } });
      if (!user || user.email !== parsed.email) return null;
      return { id: user.id, email: user.email };
    } catch {
      return null;
    }
  }
}

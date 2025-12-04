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
    const payload = `${userId}.${email}.${Date.now()}`;
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    return Buffer.from(`${payload}.${signature}`).toString('base64url');
  }

  async authenticate(token: string): Promise<{ id: string; email: string } | null> {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const parts = decoded.split('.');
      if (parts.length !== 4) return null;
      const [userId, email, issuedAt, signature] = parts;
      const secret = process.env.AUTH_SECRET || 'dev-auth-secret';
      const expectedSignature = createHmac('sha256', secret)
        .update(`${userId}.${email}.${issuedAt}`)
        .digest('hex');
      if (signature !== expectedSignature) return null;

      const user = await this._prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.email !== email) return null;
      return { id: user.id, email: user.email };
    } catch {
      return null;
    }
  }
}

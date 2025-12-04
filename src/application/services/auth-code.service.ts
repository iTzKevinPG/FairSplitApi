import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type StoredCode = {
  code: string;
  expiresAt: number;
  lastSentAt: number;
};

@Injectable()
export class AuthCodeService {
  private readonly codes = new Map<string, StoredCode>();
  private readonly codeTtlMs = 10 * 60 * 1000; // 10 minutes
  private readonly resendCooldownMs = 45 * 1000; // per-email cooldown to reduce abuse

  async sendCode(email: string): Promise<void> {
    const now = Date.now();
    const existing = this.codes.get(email);
    if (existing && now - existing.lastSentAt < this.resendCooldownMs) {
      throw new HttpException(
        { code: 'TOO_MANY_REQUESTS', message: 'Please wait before requesting another code' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.generateCode();
    this.codes.set(email, {
      code,
      expiresAt: now + this.codeTtlMs,
      lastSentAt: now,
    });

    // Placeholder for real email delivery
    // In production, integrate with an email provider here.
    // eslint-disable-next-line no-console
    console.info(`Login code for ${email}: ${code}`);
  }

  // For future HB-A2 verification use
  verifyCode(email: string, code: string): boolean {
    const stored = this.codes.get(email);
    if (!stored) return false;
    const now = Date.now();
    const isValid = stored.code === code && stored.expiresAt > now;
    if (isValid) {
      this.codes.delete(email);
    }
    return isValid;
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

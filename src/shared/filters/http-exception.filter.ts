import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

type ErrorBody = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const payload = typeof res === 'string' ? res : (res as Record<string, unknown>);
      const body = this.normalizeHttpException(payload, status);

      return response.status(status).json({
        ...body,
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    // Fallback for unexpected errors
    this.logger.error('Unexpected error', exception as Error);
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected error occurred',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private normalizeHttpException(res: string | Record<string, unknown>, status: number): ErrorBody {
    const defaults: Record<number, ErrorBody> = {
      [HttpStatus.BAD_REQUEST]: {
        code: 'BAD_REQUEST',
        message: 'Invalid request',
      },
      [HttpStatus.NOT_FOUND]: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
      [HttpStatus.CONFLICT]: {
        code: 'CONFLICT',
        message: 'Conflict',
      },
      [HttpStatus.INTERNAL_SERVER_ERROR]: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unexpected error occurred',
      },
    };

    if (typeof res === 'string') {
      return defaults[status] ?? { code: 'ERROR', message: res };
    }

    const code = (res['code'] as string) ?? defaults[status]?.code ?? 'ERROR';
    const message = (res['message'] as string) ?? defaults[status]?.message ?? 'Error';
    const fieldErrors = res['fieldErrors'] as Record<string, string> | undefined;

    return { code, message, fieldErrors };
  }
}

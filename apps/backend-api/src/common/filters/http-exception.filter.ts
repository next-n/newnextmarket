import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  LoggerService,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '../responses/api-response.type';

type ExceptionBody = {
  message?: string | string[];
  error?: string;
  errors?: unknown[];
};

function isExceptionBody(value: unknown): value is ExceptionBody {
  return typeof value === 'object' && value !== null;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService = new Logger(HttpExceptionFilter.name)) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = this.buildErrorResponse(exception, status);

    this.logger.error(
      `${request.method} ${request.url} -> ${status}: ${errorResponse.message}`,
      exception instanceof Error ? exception.stack : undefined,
      HttpExceptionFilter.name,
    );

    response.status(status).json(errorResponse);
  }

  private buildErrorResponse(
    exception: unknown,
    status: number,
  ): ApiErrorResponse {
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return {
          success: false,
          message: exceptionResponse,
          errors: [],
        };
      }

      if (isExceptionBody(exceptionResponse)) {
        const message = exceptionResponse.message;

        if (Array.isArray(message)) {
          return {
            success: false,
            message: 'Validation failed',
            errors: message,
          };
        }

        return {
          success: false,
          message: message ?? exceptionResponse.error ?? 'Error',
          errors: exceptionResponse.errors ?? [],
        };
      }
    }

    return {
      success: false,
      message:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal server error'
          : 'Error',
      errors: [],
    };
  }
}

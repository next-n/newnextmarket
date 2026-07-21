import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiSuccessResponse } from '../responses/api-response.type';

function hasApiShape(value: unknown): value is ApiSuccessResponse<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    'message' in value &&
    'data' in value
  );
}

@Injectable()
export class ApiResponseInterceptor
  implements NestInterceptor<unknown, ApiSuccessResponse<unknown>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<ApiSuccessResponse<unknown>> {
    return next.handle().pipe(
      map((payload) => {
        if (hasApiShape(payload)) {
          return payload;
        }

        if (
          typeof payload === 'object' &&
          payload !== null &&
          ('message' in payload || 'data' in payload)
        ) {
          const response = payload as { message?: string; data?: unknown };

          return {
            success: true,
            message: response.message ?? 'Success',
            data: response.data ?? {},
          };
        }

        return {
          success: true,
          message: 'Success',
          data: payload ?? {},
        };
      }),
    );
  }
}

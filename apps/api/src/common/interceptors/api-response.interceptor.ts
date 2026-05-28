import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from "@nestjs/common";
import type { Request, Response } from "express";
import { map, type Observable } from "rxjs";

export const API_RESPONSE_SKIP_HEADER = "x-skip-api-response";

type ApiResponse<T> = {
  data: T;
  meta: {
    method: string;
    path: string;
    timestamp: string;
  };
  success: true;
};

@Injectable()
export class ApiResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (response.getHeader(API_RESPONSE_SKIP_HEADER) === "true") {
          response.removeHeader(API_RESPONSE_SKIP_HEADER);
          return data as ApiResponse<T>;
        }

        return {
          data,
          meta: {
            method: request.method,
            path: request.url,
            timestamp: new Date().toISOString()
          },
          success: true as const
        };
      })
    );
  }
}

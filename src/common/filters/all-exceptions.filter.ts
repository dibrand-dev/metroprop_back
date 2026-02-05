import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'object'
          ? (exceptionResponse as any).message || exception.message
          : exceptionResponse;
      error = exception.name;
    } else if (exception instanceof Error) {
      // Handle common database errors (e.g., TypeORM QueryFailedError)
      const anyEx = exception as any;
      const driverError = anyEx?.driverError || anyEx;
      const pgCode: string | undefined = driverError?.code;

      if (anyEx?.name === 'QueryFailedError' && pgCode) {
        // Postgres error codes mapping
        switch (pgCode) {
          case '23505': { // unique_violation
            status = HttpStatus.CONFLICT;
            const detail: string = driverError?.detail || '';
            // Try to extract column name from detail: Key (email)=(value) already exists.
            let column = detail.match(/Key \(([^)]+)\)=/)?.[1];
            // If detail is missing or doesn't contain the column, try the constraint name.
            const constraint: string | undefined = driverError?.constraint;
            if (!column && constraint) {
              if (constraint.startsWith('PK_')) {
                column = 'id';
              } else {
                // Common pattern: <table>_<column>_key
                const consMatch = constraint.match(/_(.+?)_key$/);
                if (consMatch?.[1]) {
                  column = consMatch[1];
                }
              }
            }
            message = `Duplicate value for ${column || 'unique field'}.`;
            error = 'UniqueConstraintViolation';
            break;
          }
          case '23503': { // foreign_key_violation
            status = HttpStatus.BAD_REQUEST;
            message = 'Invalid reference to related record.';
            error = 'ForeignKeyViolation';
            break;
          }
          case '23502': { // not_null_violation
            status = HttpStatus.BAD_REQUEST;
            const column = driverError?.column || 'required field';
            message = `Missing required field: ${column}.`;
            error = 'NotNullViolation';
            break;
          }
          default: {
            message = exception.message;
            error = exception.name;
          }
        }
      } else {
        message = exception.message;
        error = exception.name;
      }
    }

    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      error,
    });
  }
}

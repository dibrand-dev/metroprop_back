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
      
      // Handle ConflictException specifically for duplicate field errors
      if (status === HttpStatus.CONFLICT && typeof message === 'string' && message.includes('Duplicate value for field')) {
        error = 'UniqueConstraintViolation';
      }
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
            const constraint: string | undefined = driverError?.constraint;
            
            // Try to extract column name from detail: Key (email)=(value) already exists.
            let column = detail.match(/Key \(([^)]+)\)=/)?.[1];
            
            // If detail is missing or doesn't contain the column, try the constraint name.
            if (!column && constraint) {
              // Handle different constraint naming patterns
              if (constraint.startsWith('PK_')) {
                column = 'id (primary key)';
              } else if (constraint.startsWith('uk_') || constraint.startsWith('UQ_')) {
                // Extract field from uk_table_field or UQ_hash patterns
                const ukMatch = constraint.match(/^uk_\w+_(.+)$/) || constraint.match(/^UQ_.*$/);
                if (ukMatch?.[1]) {
                  column = ukMatch[1];
                } else if (constraint.includes('email')) {
                  column = 'email';
                } else if (constraint.includes('cuit')) {
                  column = 'cuit';
                } else if (constraint.includes('app_key')) {
                  column = 'app_key';
                } else if (constraint.includes('name')) {
                  column = 'name';
                }
              } else {
                // Try to extract from general pattern: table_column_key
                const consMatch = constraint.match(/_(.+?)_key$/) || constraint.match(/_(.+?)$/);
                if (consMatch?.[1]) {
                  column = consMatch[1];
                }
              }
            }
            
            message = `Duplicate value for field '${column || 'unique field'}'. This value already exists in the database.`;
            error = 'UniqueConstraintViolation';
            
            // Log full error details for debugging
            this.logger.warn(`Unique constraint violation - Constraint: ${constraint}, Detail: ${detail}, Extracted field: ${column}`);
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

    if (status === HttpStatus.CONFLICT) {
      this.logger.error('--- 409 ConflictException Detected ---');
      this.logger.error('Exception type:', exception?.constructor?.name);
      this.logger.error('Exception object:', JSON.stringify(exception, null, 2));
      if (exception instanceof Error) {
        this.logger.error('Stack:', exception.stack);
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

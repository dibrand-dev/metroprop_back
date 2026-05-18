import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';

/**
 * Interceptor para transformar campos JSON en requests multipart/form-data
 * Convierte automáticamente strings JSON a objetos en el body del request
 */
@Injectable()
export class MultipartFormDataInterceptor implements NestInterceptor {
  private readonly jsonFields: string[];

  constructor(jsonFields: string[] = []) {
    this.jsonFields = jsonFields;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request: Request = context.switchToHttp().getRequest();

    if (request.body && this.jsonFields.length > 0) {
      // Parsear únicamente los campos JSON especificados.
      // La validación de campos desconocidos la maneja el ValidationPipe global
      // con whitelist + forbidNonWhitelisted, por lo que no se duplica aquí.
      for (const field of this.jsonFields) {
        if (request.body[field] !== undefined) {
          if (typeof request.body[field] === 'string') {
            try {
              request.body[field] = JSON.parse(request.body[field]);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Parse error';
              throw new BadRequestException(
                `Formato JSON inválido en el campo '${field}': ${errorMessage}. Asegúrate de enviar un JSON válido.`
              );
            }
          }
        }
      }
    }

    return next.handle();
  }
}
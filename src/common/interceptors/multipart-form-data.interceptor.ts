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
  private readonly allowedFileFields: string[] = ['images', 'attached'];

  constructor(jsonFields: string[] = []) {
    this.jsonFields = jsonFields;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request: Request = context.switchToHttp().getRequest();
    
    if (request.body && this.jsonFields.length > 0) {
      // Solo procesamos los campos JSON especificados
      // No validamos campos del body que multer pueda haber agregado
      
      // Parsear campos JSON especificados
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
      
      // Validar campos no esperados: solo los que NO están en jsonFields ni allowedFileFields
      const allowedFields = [...this.jsonFields, ...this.allowedFileFields];
      const bodyFieldNames = Object.keys(request.body).filter(
        key => key !== '__proto__' && key !== 'constructor'
      );
      const unexpectedFields = bodyFieldNames.filter(
        field => !allowedFields.includes(field)
      );
      
      if (unexpectedFields.length > 0) {
        const fieldsList = unexpectedFields.join(', ');
        const allowedList = allowedFields.join(', ');
        throw new BadRequestException(
          `Campo(s) no permitido(s): ${fieldsList}. Campos permitidos: ${allowedList}`
        );
      }
    }

    return next.handle();
  }
}
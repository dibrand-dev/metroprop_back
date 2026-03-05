import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  Type,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import multer from 'multer';

export interface FileFieldConfig {
  name: string;
  maxCount: number;
}

/**
 * Interceptor de upload de archivos con mensajes de error descriptivos.
 *
 * Reemplaza a FileFieldsInterceptor de NestJS para capturar errores de Multer
 * con contexto específico (nombre del campo inválido, campos permitidos, límites, etc.).
 *
 * Cualquier endpoint que maneje archivos puede usarlo para obtener errores claros
 * sin necesidad de lógica especial en el exception filter.
 *
 * @example
 * @UseInterceptors(
 *   EnhancedFileFieldsInterceptor(
 *     [{ name: 'images', maxCount: 20 }, { name: 'attached', maxCount: 20 }],
 *     { endpointDescription: 'Guardar multimedia de propiedad' }
 *   )
 * )
 */
export function EnhancedFileFieldsInterceptor(
  fields: FileFieldConfig[],
  options?: { endpointDescription?: string },
): Type<NestInterceptor> {
  const allowedFieldNames = fields.map((f) => f.name);

  @Injectable()
  class MixinInterceptor implements NestInterceptor {
    private upload = multer({ storage: multer.memoryStorage() });

    async intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Promise<Observable<any>> {
      const ctx = context.switchToHttp();
      const req = ctx.getRequest();
      const res = ctx.getResponse();

      await new Promise<void>((resolve, reject) => {
        this.upload.fields(fields as multer.Field[])(req, res, (err: any) => {
          if (!err) return resolve();

          // Multer errors carry a .code and .field property
          if (err.code) {
            switch (err.code) {
              case 'LIMIT_UNEXPECTED_FILE':
                return reject(
                  new BadRequestException({
                    message: `Campo de archivo no permitido: "${err.field}". Campos de archivo válidos: [${allowedFieldNames.join(', ')}].`,
                    error: 'UnexpectedFileField',
                    details: {
                      unexpectedField: err.field,
                      allowedFileFields: allowedFieldNames,
                      hint: 'Verifica que el nombre del campo en tu form-data coincida con los campos permitidos.',
                      ...(options?.endpointDescription && {
                        endpoint: options.endpointDescription,
                      }),
                    },
                  }),
                );

              case 'LIMIT_FILE_SIZE':
                return reject(
                  new BadRequestException({
                    message: `El archivo en el campo "${err.field}" excede el tamaño máximo permitido.`,
                    error: 'FileTooLarge',
                    details: { field: err.field },
                  }),
                );

              case 'LIMIT_FILE_COUNT': {
                const fieldConfig = fields.find((f) => f.name === err.field);
                return reject(
                  new BadRequestException({
                    message: `Se excedió el número máximo de archivos para el campo "${err.field}". Máximo permitido: ${fieldConfig?.maxCount ?? 'N/A'}.`,
                    error: 'TooManyFiles',
                    details: {
                      field: err.field,
                      maxCount: fieldConfig?.maxCount,
                    },
                  }),
                );
              }

              default:
                return reject(
                  new BadRequestException({
                    message: `Error de upload: ${err.message}`,
                    error: 'MulterError',
                    details: { code: err.code, field: err.field },
                  }),
                );
            }
          }

          // Non-multer error
          reject(
            new BadRequestException(
              err.message || 'Error procesando archivos',
            ),
          );
        });
      });

      return next.handle();
    }
  }

  return MixinInterceptor as Type<NestInterceptor>;
}

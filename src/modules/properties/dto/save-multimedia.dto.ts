import { IsArray, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Normaliza la entrada a un array de strings no vacíos.
 * - undefined / null / {} / valor no-array → []
 * - string suelto no vacío               → [string]
 * - array                                → filtra items que no sean strings o estén vacíos
 */
function toStringArray(value: any): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    if (typeof value === 'string' && value.trim() !== '') return [value];
    return [];
  }
  return value.filter((item: any) => typeof item === 'string' && item.trim() !== '');
}

/**
 * DTO principal para guardar multimedia de una propiedad.
 *
 * Todos los campos son arrays de strings (URLs).
 *
 * Reglas:
 * - Campo ausente o array vacío ([], {}) → los registros existentes de ese tipo se eliminan.
 * - Strings vacíos dentro del array son ignorados.
 * - El orden en DB se asigna por posición en el array (índice + 1).
 * - Para `images` y `attached`, los archivos nuevos se envían como multipart;
 *   las URLs del array referencian archivos ya subidos (S3 o externos).
 */
export class SaveMultimediaDto {
  /** URLs de imágenes existentes. Archivos nuevos van como multipart `images`. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => toStringArray(value))
  images?: string[];

  /** URLs de videos externos (YouTube, Vimeo, etc.) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => toStringArray(value))
  videos?: string[];

  /** URLs de tours virtuales 360 */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => toStringArray(value))
  multimedia360?: string[];

  /** URLs de adjuntos existentes. Archivos nuevos van como multipart `attached`. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => toStringArray(value))
  attached?: string[];
}
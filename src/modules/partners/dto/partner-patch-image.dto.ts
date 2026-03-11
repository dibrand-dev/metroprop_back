import { Allow, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO para actualizar metadata de una imagen via Partner API.
 * Se usa en PATCH /properties/{referenceCode}/image/{imageReferenceCode}
 */
export class PartnerPatchImageDto {
  @IsOptional()
  @IsBoolean()
  is_blueprint?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order_position?: number;

  /** Absorbs the empty file field that Swagger UI may send in multipart body */
  @Allow()
  @IsOptional()
  file?: any;
}

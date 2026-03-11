import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO para actualizar metadata de un adjunto via Partner API.
 * Se usa en PATCH /properties/{referenceCode}/attached/{attachedReferenceCode}
 */
export class PartnerPatchAttachedDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

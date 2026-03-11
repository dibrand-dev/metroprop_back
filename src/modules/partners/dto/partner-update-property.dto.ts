import { PartialType, OmitType } from '@nestjs/mapped-types';
import { PartnerCreatePropertyDto } from './partner-create-property.dto';

/**
 * DTO para actualización parcial de propiedad via Partner API.
 * Todos los campos son opcionales. Se omite branch_reference_id (no se puede cambiar).
 */
export class PartnerUpdatePropertyDto extends PartialType(
  OmitType(PartnerCreatePropertyDto, ['branch_reference_id'] as const),
) {}

import { PartialType } from '@nestjs/mapped-types';
import { CreateDevelopmentUnitDto } from './create-development-unit.dto';

export class UpdateDevelopmentUnitDto extends PartialType(CreateDevelopmentUnitDto) {}

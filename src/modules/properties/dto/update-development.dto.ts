import { PartialType } from '@nestjs/mapped-types';
import { CreateDevelopmentDto } from './create-development.dto';

export class UpdateDevelopmentDto extends PartialType(CreateDevelopmentDto) {}

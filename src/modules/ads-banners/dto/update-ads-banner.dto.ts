import { PartialType } from '@nestjs/mapped-types';
import { CreateAdsBannerDto } from './create-ads-banner.dto';

export class UpdateAdsBannerDto extends PartialType(CreateAdsBannerDto) {}

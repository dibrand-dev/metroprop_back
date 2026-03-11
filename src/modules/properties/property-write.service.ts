import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Property } from './entities/property.entity';
import { PropertyTag } from './entities/property-tag.entity';
import { PropertyVideo } from './entities/property-video.entity';

export interface VideoInput {
  url: string;
  provider?: string;
  title?: string;
  order?: number;
}

export interface Multimedia360Input {
  url: string;
  order?: number;
}

export interface PropertyCoreContext {
  organizationId?: number;
  branchId?: number;
  userId?: number;
  tags?: number[];
  videos?: VideoInput[];
  multimedia360?: Multimedia360Input[];
}

@Injectable()
export class PropertyWriteService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(PropertyTag)
    private readonly propertyTagRepo: Repository<PropertyTag>,
    @InjectRepository(PropertyVideo)
    private readonly propertyVideoRepo: Repository<PropertyVideo>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Creates the property entity and synchronises tags, videos, and multimedia360.
   * Caller is responsible for any file uploads (images, attached) that are
   * specific to its own flow.
   */
  async createPropertyCore(
    scalars: Record<string, any>,
    context: PropertyCoreContext = {},
  ): Promise<{ property: Property; warnings: string[] }> {
    const { organizationId, branchId, userId, tags, videos, multimedia360 } = context;
    const warnings: string[] = [];

    const newProperty = this.propertyRepo.create({
      ...scalars,
      ...(organizationId !== undefined ? { organization_id: organizationId } : {}),
      ...(branchId !== undefined ? { branch_id: branchId } : {}),
      ...(userId !== undefined ? { user_id: userId } : {}),
    } as any);

    const savedProperty = (await this.propertyRepo.save(newProperty)) as unknown as Property;
    const propertyId = savedProperty.id!;

    if (tags && tags.length > 0) {
      const tagWarnings = await this.syncTags(propertyId, tags);
      warnings.push(...tagWarnings);
    }

    if (videos && videos.length > 0) {
      await this.syncVideos(propertyId, videos, false);
    }

    if (multimedia360 && multimedia360.length > 0) {
      await this.syncMultimedia360(propertyId, multimedia360, false);
    }

    return { property: savedProperty, warnings };
  }

  /**
   * Updates an existing property's scalar fields and, optionally, its tags.
   * Video/multimedia360 sync is intentionally left to the caller so each
   * endpoint can apply its own replace-vs-append policy.
   */
  async updatePropertyCore(
    property: Property,
    scalars: Record<string, any>,
    context?: {
      organizationId?: number;
      branchId?: number;
      userId?: number;
      tags?: number[];
    },
  ): Promise<{ warnings: string[] }> {
    const warnings: string[] = [];

    const updateData: any = { ...scalars };
    if (context?.organizationId) updateData.organization_id = context.organizationId;
    if (context?.branchId) updateData.branch_id = context.branchId;
    if (context?.userId) updateData.user_id = context.userId;

    Object.assign(property, updateData);
    await this.propertyRepo.save(property);

    if (context?.tags !== undefined) {
      await this.propertyTagRepo.delete({ property: { id: property.id } });
      if (context.tags.length > 0) {
        const tagWarnings = await this.syncTags(property.id!, context.tags);
        warnings.push(...tagWarnings);
      }
    }

    return { warnings };
  }

  /**
   * Validates tag IDs against the tags table, inserts valid ones and returns
   * warnings for any that did not exist.
   */
  async syncTags(propertyId: number, tagIds: number[]): Promise<string[]> {
    const warnings: string[] = [];

    const existingTags = await this.dataSource.query(
      `SELECT id FROM tags WHERE id = ANY($1)`,
      [tagIds],
    );
    const existingIds = new Set(existingTags.map((t: { id: number }) => t.id));
    const validIds = tagIds.filter((id) => existingIds.has(id));
    const invalidIds = tagIds.filter((id) => !existingIds.has(id));

    if (validIds.length > 0) {
      const newTags = validIds.map((tagId) =>
        this.propertyTagRepo.create({
          tag_id: tagId,
          property: { id: propertyId } as Property,
        }),
      );
      await this.propertyTagRepo.save(newTags);
    }

    if (invalidIds.length > 0) {
      warnings.push(
        `Los siguientes tag IDs no existen y fueron ignorados: ${invalidIds.join(', ')}`,
      );
    }

    return warnings;
  }

  /**
   * Inserts (or replaces, when isUpdate=true) non-360 videos for a property.
   */
  async syncVideos(
    propertyId: number,
    videos: VideoInput[],
    isUpdate: boolean,
  ): Promise<void> {
    if (isUpdate) {
      await this.propertyVideoRepo.delete({ property: { id: propertyId }, is_360: false });
    }

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const entity = this.propertyVideoRepo.create({
        url: v.url,
        property: { id: propertyId } as Property,
        is_360: false,
        order: v.order ?? i + 1,
      });
      await this.propertyVideoRepo.save(entity);
    }
  }

  /**
   * Inserts (or replaces, when isUpdate=true) 360-degree multimedia for a property.
   */
  async syncMultimedia360(
    propertyId: number,
    items: Multimedia360Input[],
    isUpdate: boolean,
  ): Promise<void> {
    if (isUpdate) {
      await this.propertyVideoRepo.delete({ property: { id: propertyId }, is_360: true });
    }

    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      const entity = this.propertyVideoRepo.create({
        url: m.url,
        property: { id: propertyId } as Property,
        is_360: true,
        order: m.order ?? i + 1,
      });
      await this.propertyVideoRepo.save(entity);
    }
  }
}

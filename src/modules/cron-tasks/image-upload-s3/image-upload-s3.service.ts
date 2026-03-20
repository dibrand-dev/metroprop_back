import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PropertyImage } from '../../properties/entities/property-image.entity';
import { PropertyAttached } from '../../properties/entities/property-attached.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { User } from '../../users/entities/user.entity';
import { MediaService } from '../../../common/media/media.service';
import { MediaUploadStatus } from '../../../common/enums';

const BATCH_SIZE = 100;
const MAX_RETRIES = 5;

/**
 * Cron service that picks up pending external-URL images every 5 minutes,
 * downloads them and uploads to S3, updating the corresponding entity fields.
 *
 * Covers:
 *  - PropertyImage:    url LIKE 'http%' && retry_count < 5         (every 5 min)
 *  - Organization:     company_logo LIKE 'http%' && logo_retry_count < 5  (every 5 min)
 *  - Branch:           branch_logo LIKE 'http%' && logo_retry_count < 5   (every 5 min)
 *  - User:             avatar LIKE 'http%' && avatar_retry_count < 5      (every 5 min)
 *  - PropertyAttached: file_url LIKE 'http%' && retry_count < 5           (every 10 min)
 */
@Injectable()
export class ImageUploadS3Service {
  private readonly logger = new Logger(ImageUploadS3Service.name);

  constructor(
    @InjectRepository(PropertyImage)
    private readonly propertyImageRepo: Repository<PropertyImage>,
    @InjectRepository(PropertyAttached)
    private readonly propertyAttachedRepo: Repository<PropertyAttached>,
    @InjectRepository(Organization)
    private readonly organizationRepo: Repository<Organization>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mediaService: MediaService,
  ) {}

  // ─── Cron Entry Point ────────────────────────────────────────────────────────

  @Cron('0 */5 * * * *')
  async handleImageUploadCron(): Promise<void> {
    this.logger.log('[ImageUploadCron] Starting batch');

    await this.processPropertyImages();
    await this.processOrganizationLogos();
    await this.processBranchLogos();
    await this.processUserAvatars();

    this.logger.log('[ImageUploadCron] Batch complete');
  }

  // ─── Property Images ─────────────────────────────────────────────────────────

  private async processPropertyImages(): Promise<void> {
    const images = await this.propertyImageRepo
      .createQueryBuilder('img')
      .leftJoinAndSelect('img.property', 'prop')
      .where("img.url LIKE 'http%'")
      .andWhere('img.retry_count < :max', { max: MAX_RETRIES })
      .orderBy('img.created_at', 'ASC')
      .take(BATCH_SIZE)
      .getMany();

    if (!images.length) return;

    this.logger.log(`[ImageUploadCron] Processing ${images.length} property images`);

    for (const img of images) {
      await this.uploadPropertyImage(img);
    }
  }

  private async uploadPropertyImage(img: PropertyImage): Promise<void> {
    try {
      await this.propertyImageRepo.update(img.id, {
        upload_status: MediaUploadStatus.UPLOADING,
      });

      const folder = `properties/${img.property.id}/images`;
      const keys = await this.mediaService.uploadImageWithSizes(
        { originalUrl: img.url! },
        folder,
        img.id,
      );

      const fullKey = keys['FULL'];
      if (!fullKey) throw new Error('FULL size key missing after upload');

      await this.propertyImageRepo.update(img.id, {
        url: fullKey,
        upload_status: MediaUploadStatus.COMPLETED,
        upload_completed_at: new Date(),
        error_message: null,
      });

      this.logger.debug(`[ImageUploadCron] PropertyImage id=${img.id} → ${fullKey}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[ImageUploadCron] PropertyImage id=${img.id} failed: ${msg}`);

      await this.propertyImageRepo.update(img.id, {
        upload_status: MediaUploadStatus.FAILED,
        error_message: msg.substring(0, 1000),
      });
      await this.propertyImageRepo.increment({ id: img.id }, 'retry_count', 1);
    }
  }

  // ─── Organization Logos ───────────────────────────────────────────────────────

  private async processOrganizationLogos(): Promise<void> {
    const orgs = await this.organizationRepo
      .createQueryBuilder('org')
      .where("org.company_logo LIKE 'http%'")
      .andWhere('org.logo_retry_count < :max', { max: MAX_RETRIES })
      .orderBy('org.updated_at', 'ASC')
      .take(BATCH_SIZE)
      .getMany();

    if (!orgs.length) return;

    this.logger.log(`[ImageUploadCron] Processing ${orgs.length} organization logos`);

    for (const org of orgs) {
      await this.uploadOrganizationLogo(org);
    }
  }

  private async uploadOrganizationLogo(org: Organization): Promise<void> {
    try {
      const { buffer, mimetype } = await this.mediaService.downloadFromUrl(org.company_logo!);
      const ext = this.mimetypeToExt(mimetype);
      const key = this.mediaService.buildS3Key(`organizations/${org.id}`, `${Date.now()}.${ext}`);

      await this.mediaService.uploadFile(buffer, key, mimetype);
      await this.organizationRepo.update(org.id!, {
        company_logo: key,
        logo_status: null,
      });

      this.logger.debug(`[ImageUploadCron] Organization id=${org.id} logo → ${key}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[ImageUploadCron] Organization id=${org.id} logo failed: ${msg}`);

      await this.organizationRepo.update(org.id!, {
        logo_status: msg.substring(0, 1000),
      });
      await this.organizationRepo.increment({ id: org.id! }, 'logo_retry_count', 1);
    }
  }

  // ─── Branch Logos ─────────────────────────────────────────────────────────────

  private async processBranchLogos(): Promise<void> {
    const branches = await this.branchRepo
      .createQueryBuilder('b')
      .where("b.branch_logo LIKE 'http%'")
      .andWhere('b.logo_retry_count < :max', { max: MAX_RETRIES })
      .orderBy('b.updated_at', 'ASC')
      .take(BATCH_SIZE)
      .getMany();

    if (!branches.length) return;

    this.logger.log(`[ImageUploadCron] Processing ${branches.length} branch logos`);

    for (const branch of branches) {
      await this.uploadBranchLogo(branch);
    }
  }

  private async uploadBranchLogo(branch: Branch): Promise<void> {
    try {
      const { buffer, mimetype } = await this.mediaService.downloadFromUrl(branch.branch_logo!);
      const ext = this.mimetypeToExt(mimetype);
      const key = this.mediaService.buildS3Key(`branches/${branch.id}`, `${Date.now()}.${ext}`);

      await this.mediaService.uploadFile(buffer, key, mimetype);
      await this.branchRepo.update(branch.id!, {
        branch_logo: key,
        logo_status: null,
      });

      this.logger.debug(`[ImageUploadCron] Branch id=${branch.id} logo → ${key}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[ImageUploadCron] Branch id=${branch.id} logo failed: ${msg}`);

      await this.branchRepo.update(branch.id!, {
        logo_status: msg.substring(0, 1000),
      });
      await this.branchRepo.increment({ id: branch.id! }, 'logo_retry_count', 1);
    }
  }

  // ─── User Avatars ─────────────────────────────────────────────────────────────

  private async processUserAvatars(): Promise<void> {
    const users = await this.userRepo
      .createQueryBuilder('u')
      .where("u.avatar LIKE 'http%'")
      .andWhere('u.avatar_retry_count < :max', { max: MAX_RETRIES })
      .orderBy('u.updated_at', 'ASC')
      .take(BATCH_SIZE)
      .getMany();

    if (!users.length) return;

    this.logger.log(`[ImageUploadCron] Processing ${users.length} user avatars`);

    for (const user of users) {
      await this.uploadUserAvatar(user);
    }
  }

  private async uploadUserAvatar(user: User): Promise<void> {
    try {
      const { buffer, mimetype } = await this.mediaService.downloadFromUrl(user.avatar!);
      const ext = this.mimetypeToExt(mimetype);
      const key = this.mediaService.buildS3Key(`users/${user.id}`, `${Date.now()}.${ext}`);

      await this.mediaService.uploadFile(buffer, key, mimetype);
      await this.userRepo.update(user.id!, {
        avatar: key,
        avatar_status: null,
      });

      this.logger.debug(`[ImageUploadCron] User id=${user.id} avatar → ${key}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[ImageUploadCron] User id=${user.id} avatar failed: ${msg}`);

      await this.userRepo.update(user.id!, {
        avatar_status: msg.substring(0, 1000),
      });
      await this.userRepo.increment({ id: user.id! }, 'avatar_retry_count', 1);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private mimetypeToExt(mimetype: string): string {
    const sub = mimetype.split('/')[1] ?? 'jpg';
    return sub === 'jpeg' ? 'jpg' : sub;
  }

  // ─── Force-upload for a specific property ────────────────────────────────

  /**
   * Immediately processes all pending external-URL images and attached files
   * for the given property, without waiting for the scheduled cron.
   */
  async forceUploadForProperty(propertyId: number): Promise<{
    images: { attempted: number; succeeded: number; failed: number };
    attached: { attempted: number; succeeded: number; failed: number };
  }> {
    const imagesWithProp = await this.propertyImageRepo
      .createQueryBuilder('img')
      .leftJoinAndSelect('img.property', 'prop')
      .where('img.propertyId = :propertyId', { propertyId })
      .andWhere("img.url LIKE 'http%'")
      .andWhere('img.retry_count < :max', { max: MAX_RETRIES })
      .getMany();

    const attached = await this.propertyAttachedRepo
      .createQueryBuilder('att')
      .leftJoinAndSelect('att.property', 'prop')
      .where('att.propertyId = :propertyId', { propertyId })
      .andWhere("att.file_url LIKE 'http%'")
      .andWhere('att.retry_count < :max', { max: MAX_RETRIES })
      .getMany();

    const imageStats = { attempted: imagesWithProp.length, succeeded: 0, failed: 0 };
    const attachedStats = { attempted: attached.length, succeeded: 0, failed: 0 };

    this.logger.log(
      `[ForceUpload] property=${propertyId} images=${imagesWithProp.length} attached=${attached.length}`,
    );

    for (const img of imagesWithProp) {
      await this.uploadPropertyImage(img);
      const after = await this.propertyImageRepo.findOne({ where: { id: img.id } });
      if (after?.upload_status === MediaUploadStatus.COMPLETED) imageStats.succeeded++;
      else imageStats.failed++;
    }

    for (const att of attached) {
      await this.uploadPropertyAttached(att);
      const after = await this.propertyAttachedRepo.findOne({ where: { id: att.id } });
      if (after?.upload_status === MediaUploadStatus.COMPLETED) attachedStats.succeeded++;
      else attachedStats.failed++;
    }

    this.logger.log(
      `[ForceUpload] property=${propertyId} done — ` +
      `images: ${imageStats.succeeded}ok/${imageStats.failed}fail, ` +
      `attached: ${attachedStats.succeeded}ok/${attachedStats.failed}fail`,
    );

    return { images: imageStats, attached: attachedStats };
  }

  // ─── Property Attached Files ─────────────────────────────────────────────────

  @Cron('0 */10 * * * *')
  async handleAttachedUploadCron(): Promise<void> {
    this.logger.log('[AttachedUploadCron] Starting batch');
    await this.processPropertyAttached();
    this.logger.log('[AttachedUploadCron] Batch complete');
  }

  private async processPropertyAttached(): Promise<void> {
    const records = await this.propertyAttachedRepo
      .createQueryBuilder('att')
      .leftJoinAndSelect('att.property', 'prop')
      .where("att.file_url LIKE 'http%'")
      .andWhere('att.retry_count < :max', { max: MAX_RETRIES })
      .orderBy('att.created_at', 'ASC')
      .take(BATCH_SIZE)
      .getMany();

    if (!records.length) return;

    this.logger.log(`[AttachedUploadCron] Processing ${records.length} attached files`);

    for (const att of records) {
      await this.uploadPropertyAttached(att);
    }
  }

  private async uploadPropertyAttached(att: PropertyAttached): Promise<void> {
    try {
      await this.propertyAttachedRepo.update(att.id, {
        upload_status: MediaUploadStatus.UPLOADING,
      });

      const { buffer, mimetype, filename } = await this.mediaService.downloadFromUrl(att.file_url!);
      const ext = filename?.split('.').pop() || this.mimetypeToExt(mimetype);
      const key = this.mediaService.buildS3Key(
        `properties/${att.property.id}/attached`,
        `${att.id}-${Date.now()}.${ext}`,
      );

      await this.mediaService.uploadFile(buffer, key, mimetype);
      await this.propertyAttachedRepo.update(att.id, {
        file_url: key,
        upload_status: MediaUploadStatus.COMPLETED,
        upload_completed_at: new Date(),
        error_message: null,
      });

      this.logger.debug(`[AttachedUploadCron] PropertyAttached id=${att.id} → ${key}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[AttachedUploadCron] PropertyAttached id=${att.id} failed: ${msg}`);

      await this.propertyAttachedRepo.update(att.id, {
        upload_status: MediaUploadStatus.FAILED,
        error_message: msg.substring(0, 1000),
      });
      await this.propertyAttachedRepo.increment({ id: att.id }, 'retry_count', 1);
    }
  }
}

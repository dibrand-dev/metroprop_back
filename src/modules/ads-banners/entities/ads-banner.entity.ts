import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ads_banners')
export class AdsBanner {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** S3 key of the banner image */
  @Column({ type: 'varchar', length: 500, nullable: true })
  file?: string;

  /** JSON array of BannerPlacement values, e.g. "[1,2]" */
  @Column({ type: 'varchar', length: 500 })
  placements!: string;

  @Column({ type: 'boolean', default: true })
  status!: boolean;

  /** Upload error message (null = ok) */
  @Column({ type: 'varchar', length: 500, nullable: true })
  file_status?: string;

  /** Upload retry counter */
  @Column({ type: 'int', default: 0 })
  file_retry!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

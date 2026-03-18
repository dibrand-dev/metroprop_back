import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Property } from './property.entity';
import { MediaUploadStatus } from '../../../common/enums';


@Entity('property_images')
@Index('idx_property_images_property_id', ['property'])
export class PropertyImage {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url!: string | null;

  @Column({ type: 'boolean', default: false })
  is_blueprint!: boolean;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'integer', nullable: true })
  order_position?: number;

  @Column({ 
    type: 'enum', 
    enum: MediaUploadStatus, 
    nullable: true,
    default: MediaUploadStatus.PENDING 
  })
  upload_status?: MediaUploadStatus;

  @Column({ type: 'smallint', default: 0 })
  retry_count!: number;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  error_message?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  upload_completed_at?: Date | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  original_image?: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne(() => Property, (property) => property.images, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  property!: Property;
}

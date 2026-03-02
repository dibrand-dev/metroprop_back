import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Property } from './property.entity';
import { MediaUploadStatus } from '../../../common/enums';

@Entity('property_attached')
@Index('idx_property_attached_property_id', ['property'])
export class PropertyAttached {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @ManyToOne(() => Property, (property) => property.attached, {
    onDelete: 'CASCADE',
  })
  property!: Property;

  @Column({ type: 'varchar', length: 255 })
  file_url!: string;

  @Column({ type: 'int', nullable: true })
  order?: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string;

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

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

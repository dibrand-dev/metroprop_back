import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { Property } from './property.entity';

@Entity('property_videos')
@Index('idx_property_videos_property_id', ['property'])
export class PropertyVideo {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @ManyToOne(() => Property, (property) => property.videos, {
    onDelete: 'CASCADE',
  })
  property!: Property;

  @Column({ type: 'varchar', length: 255 })
  url!: string;

  @Column({ type: 'boolean', default: false })
  is_360!: boolean;

  @Column({ type: 'int', nullable: true })
  order?: number;
}

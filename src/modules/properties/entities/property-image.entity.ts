import { Entity, PrimaryColumn, Column, ManyToOne, Index } from 'typeorm';
import { Property } from './property.entity';

@Entity('property_images')
@Index('idx_property_images_property_id', ['property_id'])
export class PropertyImage {
  @PrimaryColumn('bigint')
  id!: number;

  @Column('bigint')
  property_id!: number;

  @Column({ type: 'varchar', length: 500 })
  url!: string;

  @Column({ type: 'boolean', default: false })
  is_blueprint!: boolean;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'integer', nullable: true })
  order_position?: number;

  @ManyToOne(() => Property, (property) => property.images, {
    onDelete: 'CASCADE',
  })
  property!: Property;
}

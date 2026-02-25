import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { Property } from './property.entity';


@Entity('property_images')
@Index('idx_property_images_property_id', ['property'])
export class PropertyImage {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 500 })
  url!: string;

  @Column({ type: 'boolean', default: false })
  is_blueprint!: boolean;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'integer', nullable: true })
  order_position?: number;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  status?: string | null;

  @Column({ type: 'smallint', default: 0 })
  try!: number;

  @ManyToOne(() => Property, (property) => property.images, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  property!: Property;
}

import { Entity, PrimaryColumn, Column, ManyToOne, Index } from 'typeorm';
import { Property } from './property.entity';

@Entity('property_tags')
@Index('idx_property_tags_property_id', ['property_id'])
@Index('idx_property_tags_tag_id', ['tag_id'])
export class PropertyTag {
  @PrimaryColumn('bigint')
  id!: number;

  @Column('integer')
  tag_id!: number;

  @Column('bigint')
  property_id!: number;

  @Column({ type: 'varchar', length: 255 })
  tag_name!: string;

  @Column({ type: 'integer' })
  tag_type!: number;

  @ManyToOne(() => Property, (property) => property.tags, {
    onDelete: 'CASCADE',
  })
  property!: Property;
}

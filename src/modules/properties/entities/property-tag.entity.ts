import { Entity, PrimaryColumn, Column, ManyToOne, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Property } from './property.entity';

@Entity('property_tags')
@Index('idx_property_tags_property_id', ['property'])
@Index('idx_property_tags_tag_id', ['tag_id'])
export class PropertyTag {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column('integer')
  tag_id!: number;


  @ManyToOne(() => Property, (property) => property.tags, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  property!: Property;
}

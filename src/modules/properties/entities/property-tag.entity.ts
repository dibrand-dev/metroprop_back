import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Property } from './property.entity';
import { Tag } from '../../tags/entities/tag.entity';

@Entity('property_tags')
@Index('idx_property_tags_property_id', ['property'])
@Index('idx_property_tags_tag_id', ['tag_id'])
export class PropertyTag {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column('integer')
  tag_id!: number;

  @ManyToOne(() => Tag, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tag_id' })
  tag?: Tag;

  @ManyToOne(() => Property, (property) => property.tags, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  property!: Property;
}

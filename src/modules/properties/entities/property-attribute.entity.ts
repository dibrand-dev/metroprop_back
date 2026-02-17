import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { Property } from './property.entity';


@Entity('property_attributes')
@Index('idx_property_attributes_property_id', ['property'])
export class PropertyAttribute {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  value!: string;

  @ManyToOne(() => Property, (property) => property.attributes, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  property!: Property;
}

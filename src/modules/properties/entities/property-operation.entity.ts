import { Entity, PrimaryColumn, Column, ManyToOne, Index } from 'typeorm';
import { Property } from './property.entity';

@Entity('property_operations')
@Index('idx_property_operations_property_id', ['property_id'])
export class PropertyOperation {
  @PrimaryColumn('bigint')
  id!: number;

  @Column('bigint')
  property_id!: number;

  @Column({ type: 'varchar', length: 50 })
  operation_type!: string;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  price!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  period?: string;

  @ManyToOne(() => Property, (property) => property.operations, {
    onDelete: 'CASCADE',
  })
  property!: Property;
}

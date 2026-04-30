import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Lead } from './lead.entity';
import { Property } from '../../properties/entities/property.entity';

@Entity('lead_property')
export class LeadProperty {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  lead_id!: number;

  @Column({ type: 'integer' })
  property_id!: number;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @ManyToOne(() => Lead, (lead) => lead.lead_properties, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead?: Lead;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property?: Property;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
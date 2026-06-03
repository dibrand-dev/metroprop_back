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
import { LeadState } from '@/common/enums';

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

  @Column({ type: 'varchar', length: 10, nullable: true })
  country_code?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'boolean', default: false })
  deleted: boolean = false;

  @Column({ type: 'boolean', default: false })
  highlighted: boolean = false;

  @Column({ type: 'boolean', default: false })
  blocked: boolean = false;

  @Column({ type: 'boolean', default: true })
  unread: boolean = true;

  @Column({ type: 'enum', enum: LeadState, default: LeadState.NEW })
  lead_state: LeadState = LeadState.NEW;

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
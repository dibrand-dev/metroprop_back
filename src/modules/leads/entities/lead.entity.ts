import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';
import { Property } from '../../properties/entities/property.entity';
import { LeadContactType, LeadState } from '@/common/enums';

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  country_code?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'integer', nullable: true })
  organization_id?: number;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  @Column({ type: 'integer', nullable: true })
  user_id?: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'integer', nullable: true })
  property_id?: number;

  @ManyToOne(() => Property, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property?: Property;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ type: 'enum', enum: LeadContactType, default: LeadContactType.MESSAGE })
  contact_type: LeadContactType = LeadContactType.MESSAGE;

  @Column({ type: 'boolean', default: false })
  highlighted: boolean = false;

  @Column({ type: 'boolean', default: false })
  blocked: boolean = false;

  @Column({ type: 'boolean', default: true })
  unread: boolean = true;

  @Column({ type: 'enum', enum: LeadState, default: LeadState.NEW })
  lead_state: LeadState = LeadState.NEW;

  @Column({ type: 'boolean', default: false })
  deleted: boolean = false;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
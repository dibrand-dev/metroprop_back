import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  OneToMany, 
  ManyToOne, 
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { User } from '../../users/entities/user.entity';
import { Partner } from '../../partners/entities/partner.entity';
import { ProfessionalType } from '../../../common/enums';

@Entity('organizations')
@Index('idx_organizations_cuit_unique', ['cuit'], { unique: true, where: 'deleted = false' })
@Index('idx_organizations_location_id', ['location_id'])
@Index('idx_organizations_country_id', ['country_id'])
@Index('idx_organizations_state_id', ['state_id'])
@Index('idx_organizations_sub_location_id', ['sub_location_id'])
@Index('uk_organizations_partner_external_ref', ['source_partner_id', 'external_reference'], { 
  unique: true, 
  where: 'source_partner_id IS NOT NULL AND external_reference IS NOT NULL' 
})
export class Organization {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', nullable: true })
  company_logo?: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  logo_status?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: false })
  company_name!: string;

  @Column({ type: 'varchar', nullable: true })
  address?: string;

  @Column({ type: 'varchar', nullable: true })
  phone?: string;

  @Column({ type: 'varchar', nullable: true })
  alternative_phone?: string;

  @Column({ type: 'varchar', nullable: true })
  contact_time?: string;

  @Column({ type: 'varchar', nullable: false })
  email!: string;

  @Column({ type: 'varchar', nullable: true })
  location_id?: string;

  @Column({ type: 'integer', nullable: true })
  country_id?: number;

  @Column({ type: 'integer', nullable: true })
  state_id?: number;

  @Column({ type: 'integer', nullable: true })
  sub_location_id?: number;

  @Column({ type: 'varchar', nullable: true })
  full_location?: string;

  @Column({ type: 'varchar', nullable: true })
  geo_lat?: string;

  @Column({ type: 'varchar', nullable: true })
  geo_long?: string;

  @Column({
    type: 'enum',
    enum: ProfessionalType,
    enumName: 'organizations_professional_type_enum',
    nullable: true,
  })
  professional_type?: ProfessionalType;

  @Column({ type: 'varchar', nullable: true })
  social_reason?: string;

  @Column({ type: 'varchar', nullable: true })
  cuit?: string;

  @Column({ type: 'varchar', nullable: true })
  fiscal_condition?: string;

  // ========== Partner API: referencia externa ==========
  @Column({ type: 'varchar', length: 255, nullable: true })
  external_reference?: string;

  @Column({ type: 'integer', nullable: true })
  source_partner_id?: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  tokko_key?: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @Column({ type: 'boolean', default: false })
  deleted!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at?: Date;

  // Relaciones
  @OneToMany(() => Branch, (branch) => branch.organization, {
    eager: false
  })
  branches?: Branch[];

  @OneToMany(() => User, (user) => user.organization, {
    eager: false
  })
  users?: User[];

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'admin_user' })
  admin_user?: User;

  @ManyToOne(() => Partner, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'source_partner_id' })
  source_partner?: Partner;
}
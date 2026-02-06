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

@Entity('organizations')
@Index(['email'], { unique: true })
@Index(['cuit'], { unique: true, where: 'is_deleted = false' })
export class Organization {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', nullable: true })
  company_logo?: string;

  @Column({ type: 'varchar', length: 255 })
  company_name!: string;

  @Column({ type: 'varchar', nullable: true })
  address?: string;

  @Column({ type: 'varchar', nullable: true })
  phone?: string;

  @Column({ type: 'varchar', nullable: true })
  alternative_phone?: string;

  @Column({ type: 'varchar', nullable: true })
  contact_time?: string;

  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column({ type: 'varchar', nullable: true })
  location_id?: string;

  @Column({ type: 'varchar', nullable: true })
  full_location?: string;

  @Column({ type: 'varchar', nullable: true })
  geo_lat?: string;

  @Column({ type: 'varchar', nullable: true })
  geo_long?: string;

  @Column({ type: 'varchar', nullable: true })
  professional_type?: string;

  @Column({ type: 'varchar', nullable: true })
  social_reason?: string;

  @Column({ type: 'varchar', nullable: true })
  cuit?: string;

  @Column({ type: 'varchar', nullable: true })
  fiscal_condition?: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @Column({ type: 'boolean', default: false })
  is_deleted!: boolean;

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
  @JoinColumn({ name: 'admin_user_id' })
  admin_user?: User;
}
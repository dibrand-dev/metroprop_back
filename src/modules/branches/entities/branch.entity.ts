import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  ManyToOne, 
  JoinColumn, 
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';

@Entity('branches')
@Index('idx_branches_organization', ['organization'])
export class Branch {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true })
  branch_logo?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  branch_name?: string;

  @Column({ type: 'varchar', nullable: true })
  address?: string;

  @Column({ type: 'varchar', nullable: true })
  phone?: string;

  @Column({ type: 'varchar', nullable: true })
  alternative_phone?: string;

  @Column({ type: 'varchar', nullable: true })
  contact_time?: string;

  @Column({ type: 'varchar' })
  email!: string;

  @Column({ type: 'varchar', nullable: true })
  location_id?: string;

  @Column({ type: 'varchar', nullable: true })
  full_location?: string;

  @Column({ type: 'numeric', precision: 10, scale: 8, nullable: true })
  geo_lat?: number;

  @Column({ type: 'numeric', precision: 11, scale: 8, nullable: true })
  geo_long?: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @Column({ type: 'boolean', default: false })
  deleted!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at?: Date;

  // Relaciones
  @ManyToOne(() => Organization, (org) => org.branches, { 
    onDelete: 'CASCADE',
    eager: false 
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToMany(() => User, (user) => user.branches, {
    eager: false
  })
  users?: User[];
}
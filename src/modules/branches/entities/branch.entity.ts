import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, ManyToMany } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true })
  branch_logo?: string;

  @Column()
  branch_name!: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  alternative_phone?: string;

  @Column({ nullable: true })
  contact_time?: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  location_id?: string;

  @Column({ nullable: true })
  full_location?: string;

  @Column({ nullable: true })
  geo_lat?: string;

  @Column({ nullable: true })
  geo_long?: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToMany(() => User, (user) => user.branches)
  users!: User[];
}
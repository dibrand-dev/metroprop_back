import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('organizations')
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

  @Column({ type: 'boolean', default: false })
  deleted!: boolean;
}
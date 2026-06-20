import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('locations_new')
export class LocationNew {
  
  @PrimaryColumn({ type: 'integer' })    
  id!: number;

  @Column()
    name!: string;

  @Column({ nullable: true })
    iso_code!: string;

  @Column({ nullable: true })
    sap_code!: number;

  @Column({ nullable: true })
    full_location!: string;

  @Column({ nullable: true })
    zip_code!: string;

  @Column({ nullable: true })
    short_location!: string;

  @Column({ nullable: true })
    parent_id!: number;

  @Column({ nullable: true })
    country_id!: number;

  @Column({ nullable: true })
    state_id!: number;

  @Column()
    type!: string;

  @Column({ default: false })
    migrated!: boolean;

  @Column({ nullable: true })
    status!: string;

  @Column({ default: 0 })
    failed_migration_try?: number;
}

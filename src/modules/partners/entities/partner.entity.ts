import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('partners')
@Index('uk_partners_app_key', ['app_key'], { unique: true })
export class Partner {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 255 })
  app_key!: string;

  @Column({ type: 'varchar', length: 255 })
  app_secret!: string;

  @Column({ type: 'smallint', default: 0 })
  status!: number;

  @Column({ type: 'boolean', default: false })
  deleted!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}

import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column,
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('permissions')
@Index(['name'], { unique: true })
export class Permission {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  action!: string; // ej: 'create', 'read', 'update', 'delete'

  @Column({ type: 'varchar', length: 255 })
  resource!: string; // ej: 'users', 'properties', 'roles'

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @Column({ type: 'boolean', default: false })
  is_deleted!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at?: Date;

  // Relación ManyToMany con User
  @ManyToMany(() => User, (user) => user.permissions, {
    eager: false
  })
  users?: User[];
}
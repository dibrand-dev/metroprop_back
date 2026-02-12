import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { Permission } from '../../permissions/entities/permission.entity';
import { Branch } from '../../branches/entities/branch.entity';

@Entity('users')
@Index('uk_users_email', ['email'], { unique: true, where: 'email IS NOT NULL' })
export class User {
  @PrimaryGeneratedColumn() // ahora integer autoincrement (serial en SQL)
  id!: number;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  google_id?: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  email!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  password!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar?: string;

  @Column({ type: 'boolean', default: false })
  is_verified!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @Column({ type: 'boolean', default: false })
  deleted!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at?: Date;

  // Relaciones
  @ManyToOne(() => Role, (role) => role.users, { 
    onDelete: 'RESTRICT',
    nullable: true,
    eager: false 
  })
  @JoinColumn({ name: 'role_id' })
  role?: Role;

  @ManyToOne(() => Organization, (org) => org.users, { 
    onDelete: 'CASCADE', 
    nullable: true,
    eager: false 
  })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  @ManyToMany(() => Permission, (permission) => permission.users, {
    eager: false
  })
  @JoinTable({
    name: 'users_permissions',
    joinColumn: { 
      name: 'user_id', 
      referencedColumnName: 'id' 
    },
    inverseJoinColumn: { 
      name: 'permission_id', 
      referencedColumnName: 'id' 
    }
  })
  permissions?: Permission[];

  @ManyToMany(() => Branch, (branch) => branch.users, {
    eager: false
  })
  @JoinTable({
    name: 'users_branches',
    joinColumn: {
      name: 'user_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'branch_id',
      referencedColumnName: 'id',
    },
  })
  branches?: Branch[];
}

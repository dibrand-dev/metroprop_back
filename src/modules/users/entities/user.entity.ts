import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { UserRole } from '../../../common/enums';

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

  @Column({ type: 'varchar', length: 1000, nullable: true })
  avatar_status?: string | null;

  @Column({ type: 'smallint', default: 0 })
  avatar_retry_count!: number;

  @Column({ type: 'integer', nullable: true })
  organization_id?: number;

  @Column({ type: 'boolean', default: false })
  is_verified!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email_verification_token?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password_reset_token?: string;

  @Column({ type: 'timestamp', nullable: true })
  password_reset_token_expires?: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @Column({ type: 'boolean', default: false })
  deleted!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at?: Date;

  // Relaciones
  @Column({
    type: 'integer',
    nullable: false,
    default: UserRole.USER_ROL_SELLER,
  })
  role_id!: UserRole;

  @ManyToOne(() => Organization, (org) => org.users, { 
    onDelete: 'CASCADE', 
    nullable: true,
    eager: false 
  })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

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

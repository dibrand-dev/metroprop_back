import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('properties')
@Index(['ownerId'])
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 255 })
  address!: string;

  @Column({ type: 'varchar', length: 100 })
  city!: string;

  @Column({ type: 'varchar', length: 100 })
  state!: string;

  @Column({ type: 'varchar', length: 20 })
  zipCode!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  area!: number;

  @Column({ type: 'integer' })
  bedrooms!: number;

  @Column({ type: 'integer' })
  bathrooms!: number;

  @Column({ type: 'text', array: true, nullable: true })
  amenities?: string[];

  @Column({ type: 'text', array: true, nullable: true })
  images?: string[];

  @Column({ type: 'enum', enum: ['apartment', 'house', 'land', 'commercial'], default: 'house' })
  propertyType!: string;

  @Column({ type: 'enum', enum: ['available', 'sold', 'rented'], default: 'available' })
  status!: string;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  latitude?: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude?: number;

  @ManyToOne(() => User, (user) => user.properties, { onDelete: 'CASCADE' })
  owner!: User;

  @Column({ type: 'uuid' })
  ownerId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { PropertyImage } from './property-image.entity';
import { PropertyAttribute } from './property-attribute.entity';
import { PropertyOperation } from './property-operation.entity';
import { PropertyTag } from './property-tag.entity';

@Entity('properties')
@Index('idx_properties_status', ['status'])
@Index('idx_properties_property_type', ['property_type'])
@Index('idx_properties_location_id', ['location_id'])
@Index('idx_properties_reference_code', ['reference_code'])
@Index('idx_properties_branch', ['branch'])
export class Property {
  @PrimaryGeneratedColumn('increment')
  id?: number;

  // ========== Identificadores ==========
  @Column({ type: 'varchar', length: 100, unique: true, nullable: false })
  reference_code!: string;

  // ========== Datos Básicos ==========
  @Column({ type: 'varchar', length: 500, nullable: false })
  publication_title!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  publication_title_en?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  internal_comments?: string;

  // ========== Ubicación ==========
  @Column({ type: 'varchar', length: 255, nullable: true })
  street?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  number?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  floor?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  apartment?: string;

  @Column({ type: 'integer', nullable: true })
  location_id?: number;

  // ========== Coordenadas Geográficas ==========
  @Column({ type: 'numeric', precision: 10, scale: 8, nullable: true })
  geo_lat?: number;

  @Column({ type: 'numeric', precision: 11, scale: 8, nullable: true })
  geo_long?: number;

  // ========== Tipo de Propiedad y Negocio ==========
  @Column({ type: 'integer', nullable: false })
  property_type!: number;

  @Column({ type: 'integer', nullable: false })
  status!: number;

  // ========== Características Principales ==========
  @Column({ type: 'integer', nullable: true })
  suite_amount?: number;

  @Column({ type: 'integer', nullable: true })
  room_amount?: number;

  @Column({ type: 'integer', nullable: true })
  bathroom_amount?: number;

  @Column({ type: 'integer', nullable: true })
  toilet_amount?: number;

  @Column({ type: 'integer', nullable: true })
  parking_lot_amount?: number;

  // ========== Superficies (en m²) ==========
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  surface?: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  roofed_surface?: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  unroofed_surface?: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  semiroofed_surface?: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  total_surface?: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  surface_measurement?: string;

  // ========== Información del Inmueble ==========
  @Column({ type: 'integer', nullable: true })
  age?: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  property_condition?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  situation?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  dispositions?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  orientation?: string;

  @Column({ type: 'integer', nullable: true })
  floors_amount?: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  zonification?: string;

  // ========== Información Económica ==========
  @Column({ type: 'integer', nullable: true })
  expenses?: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  commission?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  network_share?: string;

  // ========== Operación y Precio (denormalizado para acceso rápido) ==========
  @Column({ type: 'varchar', length: 50, nullable: false })
  operation_type!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: false })
  price!: number;

  @Column({ type: 'varchar', length: 3, nullable: false })
  currency!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  period?: string;

  // ========== Información de Contacto y Responsables ==========
  @Column({ type: 'varchar', length: 255, nullable: true })
  producer_user?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  branch?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  key_contact?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  key_agent_user?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  key_location?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  key_reference_code?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  maintenance_user?: string;

  // ========== Información de Desarrollo ==========
  @Column({ type: 'varchar', length: 255, nullable: true })
  development?: string;

  // ========== Información de Red ==========
  @Column({ type: 'text', nullable: true })
  network_information?: string;

  @Column({ type: 'text', nullable: true })
  transaction_requirements?: string;

  // ========== Auditoría y Control ==========
  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at: Date | null = null;

  @Column({ type: 'boolean', default: false })
  deleted?: boolean;

  // ========== Relaciones ==========
  @OneToMany(() => PropertyImage, (image) => image.property, {
    cascade: true,
    eager: false,
  })
  images?: PropertyImage[];

  @OneToMany(() => PropertyAttribute, (attr) => attr.property, {
    cascade: true,
    eager: false,
  })
  attributes?: PropertyAttribute[];

  @OneToMany(() => PropertyOperation, (op) => op.property, {
    cascade: true,
    eager: false,
  })
  operations?: PropertyOperation[];

  @OneToMany(() => PropertyTag, (tag) => tag.property, {
    cascade: true,
    eager: false,
  })
  tags?: PropertyTag[];
}

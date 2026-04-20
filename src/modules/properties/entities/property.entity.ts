import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PropertyImage } from './property-image.entity';
import { PropertyAttribute } from './property-attribute.entity';
import { PropertyTag } from './property-tag.entity';
import { PropertyVideo } from './property-video.entity';
import { PropertyAttached } from './property-attached.entity';
import { 
  PropertyType, 
  PropertyStatus, 
  OperationType, 
  Currency, 
  SurfaceMeasurement,
  Orientation,
  Disposition,
  TemporalRentPeriod,
  Brightness,
  GarageCoverage,
  PublicationPlan,
  PropertySubtype,
  DevelopmentType,
} from '../../../common/enums';
import { Organization } from '@/modules/organizations/entities/organization.entity';

@Entity('properties')
@Index('idx_properties_status', ['status'])
@Index('idx_properties_property_type', ['property_type'])
@Index('idx_properties_location_id', ['location_id'])
@Index('idx_properties_country_id', ['country_id'])
@Index('idx_properties_state_id', ['state_id'])
@Index('idx_properties_sub_location_id', ['sub_location_id'])
@Index('idx_properties_reference_code', ['reference_code'])
// @Index('idx_properties_branch', ['branch'])
export class Property {

  @PrimaryGeneratedColumn('increment')
  id?: number;

  // ========== Identificadores ==========
  @Column({ type: 'varchar', length: 100, unique: true, nullable: false })
  reference_code!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tokko_id?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  publication_id?: string;

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

  @Column({ type: 'integer', nullable: true })
  country_id?: number;

  @Column({ type: 'integer', nullable: true })
  state_id?: number;

  @Column({ type: 'integer', nullable: true })
  sub_location_id?: number;

  // ========== Coordenadas Geográficas ==========
  @Column({ type: 'numeric', precision: 10, scale: 8, nullable: true })
  geo_lat?: number;

  @Column({ type: 'numeric', precision: 11, scale: 8, nullable: true })
  geo_long?: number;

  @Column({ type: 'boolean', nullable: true, default: false })
  show_exact_location?: boolean;

  // ========== Tipo de Propiedad y Negocio ==========
  @Column({ type: 'integer', nullable: false })
  property_type!: PropertyType;

  @Column({ type: 'integer', nullable: true })
  property_subtype!: PropertySubtype;

  @Column({ type: 'integer', nullable: false, default: PropertyStatus.DISPONIBLE })
  status!: PropertyStatus;

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

  @Column({ type: 'varchar', length: 10, nullable: true, default: SurfaceMeasurement.M2 })
  surface_measurement?: SurfaceMeasurement;

  @Column({ type: 'varchar', length: 10, nullable: true, default: SurfaceMeasurement.M2 })
  roofed_surface_measurement?: SurfaceMeasurement;

  // ========== Información del Inmueble ==========
  @Column({ type: 'integer', nullable: true })
  age?: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  property_condition?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  situation?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  dispositions?: Disposition;

  @Column({ type: 'varchar', length: 50, nullable: true })
  orientation?: Orientation;

  @Column({ type: 'integer', nullable: true })
  brightness?: Brightness;

  @Column({ type: 'integer', nullable: true })
  garage_coverage?: GarageCoverage;

  @Column({ type: 'integer', nullable: true })
  surface_front?: number;

  @Column({ type: 'integer', nullable: true })
  surface_length?: number;

  @Column({ type: 'boolean', nullable: true, default: false })
  credit_eligible?: boolean;

  @Column({ type: 'boolean', nullable: true, default: false })
  has_sign?: boolean;

  @Column({ type: 'integer', nullable: true })
  floors_amount?: number;

  @Column({ type: 'integer', nullable: true })
  apartments_per_floor?: number;

  @Column({ type: 'integer', nullable: true })
  warehouse_units?: number;

  @Column({ type: 'integer', nullable: true })
  number_of_guests?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  business_type?: string;

  @Column({ type: 'integer', nullable: true })
  fot?: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  zonification?: string;

  @Column({ type: 'boolean', default: false })
  direct_owner?: boolean;

  // ========== Información Económica ==========
  @Column({ type: 'integer', nullable: true })
  expenses?: number;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency_expenses?: Currency;

  @Column({ type: 'varchar', length: 50, nullable: true })
  commission?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  network_share?: string;

  // ========== Operación y Precio (denormalizado para acceso rápido) ==========
  @Column({ type: 'integer', nullable: false })
  operation_type!: OperationType;

  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: false })
  price!: number;

  @Column({ type: 'varchar', length: 3, nullable: false, default: Currency.USD })
  currency!: Currency;

  @Column({ type: 'integer', nullable: true })
  period?: TemporalRentPeriod;

  @Column({ type: 'integer', nullable: true, default: PublicationPlan.PUBLICATION_FREE })
  selected_plan?: PublicationPlan;

  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: true })
  price_square_meter?: number;

  // ========== Información de Contacto y Responsables ==========
  @Column({ type: 'varchar', length: 255, nullable: true })
  owner_name?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  owner_phone?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  owner_email?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postal_code?: string;
  @Column({ type: 'varchar', length: 255, nullable: true })
  producer_user?: string;

  @Column({ type: 'integer', nullable: true })
  branch_id?: number;

  @Column({ type: 'integer', nullable: true })
  user_id?: number;

  @Column({ type: 'integer', nullable: true })
  organization_id?: number;

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

  @Column({ type: 'varchar', length: 10, nullable: true })
  construction_year?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  last_renovation?: string;

  // ========== Información de Desarrollo ==========
  @Column({ type: 'varchar', length: 255, nullable: true })
  development?: string;

  // ========== Emprendimiento ==========
  @Column({ type: 'boolean', default: false, nullable: true })
  is_development?: boolean;

  @Column({ type: 'integer', nullable: true })
  development_id?: number;

  @Column({ type: 'integer', nullable: true })
  development_type?: DevelopmentType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  development_logo?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  development_logo_status?: string;

  @Column({ type: 'integer', nullable: true, default: 0 })
  development_logo_retry_count?: number;

  @Column({ type: 'integer', nullable: true })
  development_units_total?: number;

  @Column({ type: 'date', nullable: true })
  development_delivery_date?: Date;

  @Column({ type: 'integer', nullable: true })
  development_available_unit_count?: number;

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

  @OneToMany(() => PropertyAttribute, (attribute) => attribute.property, {
    cascade: true,
    eager: true,
  })
  attributes?: PropertyAttribute[];

  @OneToMany(() => PropertyTag, (tag) => tag.property, {
    cascade: true,
    eager: true,
  })
  tags?: PropertyTag[];

  @OneToMany(() => PropertyVideo, (video) => video.property, {
    cascade: true,
    eager: true,
  })
  videos?: PropertyVideo[];

  @OneToMany(() => PropertyAttached, (attached) => attached.property, {
    cascade: true,
    eager: true,
  })
  attached?: PropertyAttached[];

  
  // Relación con Organization
  @ManyToOne(() => Organization, { nullable: true, eager: false })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;


}

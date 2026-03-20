import { Injectable, NotFoundException } from '@nestjs/common';
import { Property } from '../../modules/properties/entities/property.entity';
import { PropertiesService } from '../../modules/properties/properties.service';
import { TagsService } from '../../modules/tags/tags.service';
import { BranchesService } from '../../modules/branches/branches.service';
import { UsersService } from '../../modules/users/users.service';
import { OrganizationsService } from '../../modules/organizations/organizations.service';
import { LocationsService } from '../../modules/locations/locations.service';
import { PropertyType, OperationType, SurfaceMeasurement, Orientation, Disposition, PropertyStatus, Currency, GarageCoverage, UserRole, ProfessionalType } from '../enums';
import { CreatePropertyDto } from '../../modules/properties/dto/create-property.dto';
import axios from 'axios';

export interface TokkoPropertyResponse {
  id?: number;
  address: string;
  address_complement: string;
  age: number;
  apartment_door: string;
  appartments_per_floor: number;
  bathroom_amount: number;
  block_number: string;
  branch: any; // Ignorado según especificación
  building: string;
  cleaning_tax: string;
  common_area: string;
  covered_parking_lot: number;
  created_at: string;
  credit_eligible: string;
  custom1: string;
  custom_tags: any[]; // Manejado por separado
  deleted_at: string | null;
  depth_measure: string;
  description: string;
  development: string | null;
  development_excel_extra_data: string;
  dining_room: number;
  disposition: string | null;
  down_payment: string;
  expenses: number;
  extra_attributes: any[]; // Ignorado según especificación
  fake_address: string;
  files: any[];
  fire_insurance_cost: string;
  floor: string;
  floors_amount: number;
  front_measure: string;
  geo_lat: string;
  geo_long: string;
  gm_location_type: string;
  guests_amount: number;
  has_temporary_rent: boolean;
  internal_data: any;
  iptu: string;
  is_denounced: boolean;
  is_starred_on_web: boolean;
  legally_checked: string;
  livable_area: string;
  living_amount: number;
  location: any;
  location_level: any;
  lot_number: string;
  occupation: any[];
  operations: any[];
  orientation: string;
  parking_lot_amount: number;
  parking_lot_condition: any;
  parking_lot_type: any;
  photos: any[];
  portal_footer: string;
  private_area: string;
  producer: any;
  property_condition: string;
  public_url: string;
  publication_title: string;
  quality_level: any;
  real_address: string;
  reference_code: string;
  rich_description: string;
  roofed_surface: string;
  room_amount: number;
  semiroofed_surface: string;
  seo_description: string;
  seo_keywords: string;
  situation: string;
  status: number;
  suite_amount: number;
  suites_with_closets: number;
  surface: string;
  surface_measurement: string;
  tags: any[]; // Ignorado según especificación
  toilet_amount: number;
  total_suites: number;
  total_surface: string;
  transaction_requirements: string;
  tv_rooms: number;
  type: any;
  uncovered_parking_lot: number;
  unroofed_surface: string;
  videos: any[];
  web_price: boolean;
  zonification: string;
  // Campo adicional según especificación
  has_sign?: boolean;
}

export interface TokkoToMetropropResponse {
  // Datos principales
  reference_code: string;
  publication_title: string;
  property_type: PropertyType;
  status: PropertyStatus;
  operation_type: OperationType;
  price: number;
  currency: Currency;

  // Freeportals identifiers
  tokko_id?: string;
  publication_id?: string;
  
  // Campos opcionales mapeados
  description?: string;
  street?: string;
  apartment?: string;
  floor?: string;
  apartments_per_floor?: number;
  location_id?: number;
  country_id?: number;
  state_id?: number;
  sub_location_id?: number;
  geo_lat?: number;
  geo_long?: number;
  suite_amount?: number;
  room_amount?: number;
  bathroom_amount?: number;
  toilet_amount?: number;
  parking_lot_amount?: number;
  surface?: number;
  roofed_surface?: number;
  unroofed_surface?: number;
  semiroofed_surface?: number;
  total_surface?: number;
  surface_measurement?: SurfaceMeasurement;
  age?: number;
  property_condition?: string;
  situation?: string;
  dispositions?: Disposition;
  orientation?: Orientation;
  garage_coverage?: GarageCoverage;
  surface_front?: number;
  surface_length?: number;
  credit_eligible?: boolean;
  floors_amount?: number;
  number_of_guests?: number;
  zonification?: string;
  expenses?: number;
  commission?: string;
  period?: number;
  transaction_requirements?: string;
  development?: string;
  network_information?: string;
  internal_comments?: string;
  producer_user?: string;
  user_id?: number;
  branch_id?: number;
  organization_id?: number;
  key_location?: string;
  maintenance_user?: string;
  postal_code?: string;
  has_sign?: boolean;
  
  // Owner information
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  
  // Arrays de relaciones
  images?: Array<{
    url: string;
    description?: string;
    is_blueprint?: boolean;
    order_position?: number;
  }>;
  
  videos?: Array<{
    url: string;
    order?: number;
    description?: string;
  }>;
  
  attached?: Array<{
    file_url: string;
    description?: string;
    order?: number;
  }>;
  
  tags?: number[]; // IDs de tags a asignar
}

@Injectable()
export class TokkoHelperService {
  // Constante del dominio base de la API de Tokko
  private readonly TOKKO_BASE_URL = 'http://www.tokkobroker.com/api/v1/';

  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly tagsService: TagsService,
    private readonly branchesService: BranchesService,
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
    private readonly locationsService: LocationsService,
  ) {}

  /**
   * Convierte una propiedad de formato Tokko a formato Metroprop
   * @param tokkoData Datos de la propiedad en formato Tokko
   * @param preloadedData Información pre-cargada de organización, branches y usuarios (opcional)
   * @returns Propiedad en formato compatible con CreatePropertyDto
   */
  async mapToMetropropFormat(
    tokkoData: TokkoPropertyResponse, 
    preloadedData?: {
      organization: any;
      branchesMap: Map<string, any>;
      usersMap: Map<string, any>;
    }
  ): Promise<TokkoToMetropropResponse> {
    // Procesar custom tags para detectar has_sign
    const hasSign = this.extractHasSignFromCustomTags(tokkoData.custom_tags || []);

    // Procesar tags para mapeo
    const { mappedTagIds, unmappedTags } = await this.processTagsMapping(tokkoData);

    // Generar descripción adicional con tags no mapeados
    const unmappedTagsDescription = this.generateUnmappedTagsDescription(unmappedTags);

    // Mapeo principal inverso
    const metropropProperty: TokkoToMetropropResponse = {
      // Campos obligatorios
      reference_code: tokkoData.reference_code || '',
      publication_title: tokkoData.publication_title || '',
      property_type: this.mapTokkoPropertyTypeToEnum(tokkoData.type),
      status: this.mapTokkoStatusToEnum(tokkoData.status),
      operation_type: this.mapTokkoOperationTypeToEnum(tokkoData.operations),
      price: this.extractPriceFromOperations(tokkoData.operations),
      currency: this.extractCurrencyFromOperations(tokkoData.operations) as Currency,
      
      // IDs de organización, branch y usuario usando información pre-cargada
      organization_id: preloadedData?.organization?.id || undefined,
      branch_id: this.mapTokkoBranch(tokkoData.branch, preloadedData?.branchesMap),
      user_id: this.mapTokkoMaintenanceUser(tokkoData.internal_data, preloadedData?.usersMap),
      
      // Owner information del primer property_owner
      ...this.mapTokkoPropertyOwner(tokkoData.internal_data?.property_owners),
      
      // Campos opcionales - mapeos directos
      description: this.combineDescription(tokkoData.description, unmappedTagsDescription),
      age: tokkoData.age || undefined,
      bathroom_amount: tokkoData.bathroom_amount || undefined,
      floor: tokkoData.floor || undefined,
      floors_amount: tokkoData.floors_amount || undefined,
      geo_lat: this.parseNumericString(tokkoData.geo_lat),
      geo_long: this.parseNumericString(tokkoData.geo_long),
      parking_lot_amount: tokkoData.parking_lot_amount || undefined,
      property_condition: tokkoData.property_condition || undefined,
      room_amount: tokkoData.room_amount || undefined,
      situation: tokkoData.situation || undefined,
      suite_amount: tokkoData.suite_amount || undefined,
      toilet_amount: tokkoData.toilet_amount || undefined,
      zonification: tokkoData.zonification || undefined,
      expenses: tokkoData.expenses || undefined,
      transaction_requirements: tokkoData.transaction_requirements || undefined,
      development: tokkoData.development || undefined,
      
      // Mapeos con equivalencias específicas (inverso)
      street: tokkoData.address || tokkoData.real_address || undefined, // address/real_address -> street
      apartment: tokkoData.apartment_door || undefined, // apartment_door -> apartment
      apartments_per_floor: tokkoData.appartments_per_floor || undefined, // appartments_per_floor -> apartments_per_floor
      garage_coverage: this.mapTokkoGarageCoverage(tokkoData), // covered/uncovered -> garage_coverage
      surface_length: this.parseIntegerString(tokkoData.depth_measure), // depth_measure -> surface_length  
      surface_front: this.parseIntegerString(tokkoData.front_measure), // front_measure -> surface_front
      dispositions: this.mapTokkoDisposition(tokkoData.disposition), // disposition -> dispositions
      number_of_guests: tokkoData.guests_amount || undefined, // guests_amount -> number_of_guests
      
      // Superficies
      surface: this.parseNumericString(tokkoData.surface),
      roofed_surface: this.parseNumericString(tokkoData.roofed_surface),
      unroofed_surface: this.parseNumericString(tokkoData.unroofed_surface),
      semiroofed_surface: this.parseNumericString(tokkoData.semiroofed_surface),
      total_surface: this.parseNumericString(tokkoData.total_surface),
      surface_measurement: this.mapTokkoSurfaceMeasurement(tokkoData.surface_measurement),
      
      // Enums
      orientation: this.mapTokkoOrientation(tokkoData.orientation),
      credit_eligible: this.mapTokkoStringToBoolean(tokkoData.credit_eligible),
      
      // Campos adicionales
      has_sign: hasSign,
      
      // Internal data mappings
      internal_comments: tokkoData.internal_data?.internal_comments || undefined,
      commission: tokkoData.internal_data?.commission || undefined,
      key_location: tokkoData.internal_data?.key_location || undefined,
      maintenance_user: tokkoData.internal_data?.maintenance_user?.name || undefined,
      network_information: tokkoData.internal_data?.network_information || undefined,
      
      // Producer data
      producer_user: tokkoData.producer?.name || undefined,
      
      // Location data  
      location_id: tokkoData.location?.id || undefined,
      postal_code: tokkoData.location?.zip_code || undefined,
      
      // Operaciones (ya extraído el precio y currency)
      period: this.extractPeriodFromOperations(tokkoData.operations),
      
      // Multimedia mappings
      images: this.mapTokkoPhotosToImagesDto(tokkoData.photos || []),
      videos: this.mapTokkoVideos(tokkoData.videos || []),
      attached: this.mapTokkoFiles(tokkoData.files || []),
      // All tags mapeads
      tags: mappedTagIds
    };

    return metropropProperty;
  }
 

  /**
   * Lista campos que no tienen mapeo directo todavía
   */
  getUnmappedFields(): string[] {
    return [
      // Campos que necesitan implementación adicional o campos nuevos en DB
      'address_complement', // Necesita campo en DB
      'block_number', // Necesita campo en DB  
      'building', // Necesita campo en DB
      'cleaning_tax', // Necesita campo en DB
      'common_area', // Necesita campo en DB
      'custom1', // Necesita campo en DB
      'development_excel_extra_data', // Necesita campo en DB
      'down_payment', // Necesita campo en DB
      'fake_address', // Podría usar street como fallback
      'fire_insurance_cost', // Necesita campo en DB
      'gm_location_type', // Necesita integración con Google Maps
      'has_temporary_rent', // Necesita campo en DB
      'iptu', // Necesita campo en DB (impuesto inmobiliario)
      'is_denounced', // Necesita campo en DB
      'is_starred_on_web', // Necesita campo en DB
      'legally_checked', // Necesita campo en DB
      'livable_area', // Necesita campo en DB
      'location_level', // Necesita campo en DB
      'lot_number', // Necesita campo en DB
      'occupation', // Necesita relación/tabla adicional
      'parking_lot_condition', // Necesita campo en DB
      'parking_lot_type', // Necesita campo en DB
      'portal_footer', // Necesita campo en DB
      'private_area', // Necesita campo en DB
      'public_url', // Necesita lógica de generación de URLs
      'quality_level', // Necesita campo en DB
      'seo_description', // Necesita campo en DB
      'seo_keywords', // Necesita campo en DB
      'web_price' // Podría ser un campo booleano en DB
    ];
  }

  // ========== MÉTODOS AUXILIARES PARA MAPEO INVERSO (TOKKO -> METROPROP) ==========

  /**
   * Procesa el mapeo de tags de Tokko usando la tabla tags_mapping
   */
  private async processTagsMapping(tokkoData: TokkoPropertyResponse): Promise<{
    mappedTagIds: number[];
    unmappedTags: { name: string; id?: string; category?: string }[];
  }> {
    // Obtener todos los tags de Tokko (custom_tags + tags normales)
    const allTokkoTags = [
      ...(tokkoData.custom_tags || []),
      ...(tokkoData.tags || [])
    ].filter(tag => tag && (tag.name || tag.id));

    if (!allTokkoTags.length) {
      return { mappedTagIds: [], unmappedTags: [] };
    }

    // Procesar tags con el servicio de tags
    const result = await this.tagsService.processTokkoTags(allTokkoTags);
    
    // Categorizar tags no mapeados
    const categorizedUnmappedTags = result.unmappedTags.map(tag => ({
      ...tag,
      category: this.categorizeTag(tag.type)
    }));

    return {
      mappedTagIds: result.mappedTagIds,
      unmappedTags: categorizedUnmappedTags
    };
  }

  /**
   * Categoriza un tag para organizar en la descripción
   */
  private categorizeTag(tagType: string | number): string {

    if (!tagType && tagType !== 0) {
      return 'otros';
    }
    const type = String(tagType).toLowerCase();
    if(type == "1") return 'servicios';
    if(type == "2") return 'ambientes';
    return 'otros';
  }

  /**
   * Genera la descripción adicional con tags no mapeados
   */
  private generateUnmappedTagsDescription(unmappedTags: { name: string; category?: string }[]): string {
    if (!unmappedTags.length) return '';

    const servicios = unmappedTags.filter(tag => tag.category === 'servicios');
    const ambientes = unmappedTags.filter(tag => tag.category === 'ambientes');
    const otros = unmappedTags.filter(tag => tag.category === 'otros');

    let description = '';

    if (servicios.length > 0) {
      description += '\\n\\nOtros servicios:\\n';
      servicios.forEach(tag => description += `- ${tag.name}\\n`);
    }

    if (ambientes.length > 0) {
      description += '\\n\\nOtros ambientes:\\n';
      ambientes.forEach(tag => description += `- ${tag.name}\\n`);
    }

    if (otros.length > 0) {
      description += '\\n\\nCaracterísticas adicionales:\\n';
      otros.forEach(tag => description += `- ${tag.name}\\n`);
    }

    return description;
  }

  /**
   * Combina la descripción original con la descripción de tags no mapeados
   */
  private combineDescription(originalDescription?: string, unmappedTagsDescription?: string): string | undefined {
    if (!originalDescription && !unmappedTagsDescription) return undefined;
    
    return (originalDescription || '') + (unmappedTagsDescription || '');
  }

  /**
   * Extrae has_sign de los custom tags de Tokko
   */
  private extractHasSignFromCustomTags(customTags: any[]): boolean {
    return customTags.some(tag => {

      if (tag.group_name === 'Cartel') return true;

      if (tag.name) {
        const lowerName = tag.name.toLowerCase();
        return lowerName.includes('cartel') || lowerName.includes('tiene cartel');
      }

      return false;
    });
  }


  /**
   * Mapea type de Tokko a PropertyType enum
   */
  private mapTokkoPropertyTypeToEnum(type: any): PropertyType {

    if (!type?.code) return PropertyType.CASA;
    const typeCode = type.code.toUpperCase(); 

    switch (typeCode) {
      case 'HO': return PropertyType.CASA;
      case 'AP': return PropertyType.DEPARTAMENTO;
      case 'PH': return PropertyType.PH;
      case 'LC': return PropertyType.LOCAL_COMERCIAL;
      case 'OF': return PropertyType.OFICINA_COMERCIAL;
      case 'LT': return PropertyType.TERRENO;
      default: return PropertyType.CASA;
    }
  }

  /**
   * Mapea status de Tokko a PropertyStatus enum
   */
  private mapTokkoStatusToEnum(status: number): PropertyStatus {
    // En Tokko: 1=borrador, 2=activo, 3=pausado, etc.
    // Mapear según nuestros enums
    switch (status) {
      case 1: return PropertyStatus.DRAFT;
      case 2: return PropertyStatus.DISPONIBLE;
      case 3: return PropertyStatus.RESERVADA;
      case 4: return PropertyStatus.NO_DISPONIBLE;
      default: return PropertyStatus.DISPONIBLE;
    }
  }

  /**
   * Extrae operation_type del array de operaciones de Tokko
   */
  private mapTokkoOperationTypeToEnum(operations: any[]): OperationType {
    if (!operations?.length) return OperationType.VENTA;
    
    const operationTypeValue = operations[0]?.operation_type;
    if (!operationTypeValue) return OperationType.VENTA;
    const operationType = String(operationTypeValue).toLowerCase();

    switch (operationType) {
      case 'venta': return OperationType.VENTA;
      case 'alquiler': return OperationType.ALQUILER;
      case 'alquiler temporal': return OperationType.ALQUILER_TEMPORAL;
      default: return OperationType.VENTA;
    }
  }

  /**
   * Extrae precio del array de operaciones
   */
  private extractPriceFromOperations(operations: any[]): number {
    if (!operations?.length || !operations[0]?.prices?.length) return 0;
    return operations[0].prices[0]?.price || 0;
  }

  /**
   * Extrae currency del array de operaciones
   */
  private extractCurrencyFromOperations(operations: any[]): string {
    if (!operations?.length || !operations[0]?.prices?.length) return Currency.USD;
    return operations[0].prices[0]?.currency || Currency.USD;
  }

  /**
   * Extrae period del array de operaciones
   */
  private extractPeriodFromOperations(operations: any[]): number | undefined {
    if (!operations?.length || !operations[0]?.prices?.length) return undefined;
    return operations[0].prices[0]?.period || undefined;
  }

  /**
   * Parsea string numérico a number
   */
  private parseNumericString(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Parsea string numérico a integer (trunca decimales para campos INTEGER en DB)
   */
  private parseIntegerString(value: string | undefined): number | undefined {
    const num = this.parseNumericString(value);
    return num != null ? Math.trunc(num) : undefined;
  }

  /**
   * Mapea garage coverage de Tokko
   */
  private mapTokkoGarageCoverage(tokkoData: TokkoPropertyResponse): GarageCoverage | undefined {
    if (tokkoData.covered_parking_lot > 0) return GarageCoverage.COVERED;
    if (tokkoData.uncovered_parking_lot > 0) return GarageCoverage.UNCOVERED;
    return undefined;
  }

  /**
   * Mapea disposition de Tokko
   */
  private mapTokkoDisposition(disposition: string | null): Disposition | undefined {
    if (!disposition) return undefined;
    const disp = String(disposition).toLowerCase(); 

    if (disp.includes('frente')) return Disposition.FRENTE;
    if (disp.includes('contrafrente')) return Disposition.CONTRAFRENTE;
    if (disp.includes('interno')) return Disposition.INTERNO;
    if (disp.includes('lateral')) return Disposition.LATERAL;
    return undefined;
  }

  /**
   * Mapea surface measurement de Tokko
   */
  private mapTokkoSurfaceMeasurement(measurement: string | undefined): SurfaceMeasurement {
    
    if (!measurement) return SurfaceMeasurement.M2;
    
    const upperMeasurement = String(measurement).toUpperCase(); 
    switch (upperMeasurement) {
      case 'M2': return SurfaceMeasurement.M2;
      case 'HA': return SurfaceMeasurement.HA;
      default: return SurfaceMeasurement.M2;
    }
  }

  /**
   * Mapea orientation de Tokko
   */
  private mapTokkoOrientation(orientation: string | undefined): Orientation | undefined {
    
    if (!orientation) return undefined;
    
    const orient = orientation.toLowerCase();
    if (orient.includes('norte')) return Orientation.NORTE;
    if (orient.includes('sur')) return Orientation.SUR;
    if (orient.includes('este')) return Orientation.ESTE;
    if (orient.includes('oeste')) return Orientation.OESTE;
    if (orient.includes('noreste')) return Orientation.NORESTE;
    if (orient.includes('noroeste')) return Orientation.NOROESTE;
    if (orient.includes('sudeste')) return Orientation.SUDESTE;
    if (orient.includes('sudoeste')) return Orientation.SUDOESTE;
    return undefined;
  }

  /**
   * Mapea string de credit_eligible a boolean
   */
  private mapTokkoStringToBoolean(value: string | undefined): boolean | undefined {

    if (!value) return undefined;
    const val = value.toLowerCase();

    if (val === 'sí' || val === 'si' || val === 'yes' || val === 'true') return true;
    if (val === 'no' || val === 'false') return false;
    return undefined;
  }

  /**
   * Mapea videos de Tokko
   */
  private mapTokkoVideos(videos: any[]): any[] {
    return videos.map(video => ({
      url: video.url || video.player_url || video.video_url || '',
      order: video.order || 1,
      description: video.title || video.description || undefined
    }));
  }

  /**
   * Mapea files de Tokko a attached
   */
  private mapTokkoFiles(files: any[]): any[] {
    return files.map(file => ({
      file_url: file.file_url || '',
      description: file.description || undefined,
      order: file.order || 0
    }));
  }

  /**
   * Mapea branch de Tokko usando external_reference de la información pre-cargada
   */
  private mapTokkoBranch(branchData: any, branchesMap?: Map<string, any>): number | undefined {
    if (!branchData?.id || !branchesMap) return undefined;
    
    const branch = branchesMap.get(branchData.id.toString());
    return branch?.id || undefined;
  }

  /**
   * Mapea maintenance_user de Tokko usando external_reference de la información pre-cargada  
   */
  private mapTokkoMaintenanceUser(internalData: any, usersMap?: Map<string, any>): number | undefined {
    const maintenanceUser = internalData?.maintenance_user;
    if (!maintenanceUser?.id || !usersMap) return undefined;
    
    const user = usersMap.get(maintenanceUser.id.toString());
    return user?.id || undefined;
  }

  /**
   * Mapea property_owner (toma el primer elemento del array)
   */
  private mapTokkoPropertyOwner(propertyOwners: any[]): {
    owner_name?: string;
    owner_email?: string;  
    owner_phone?: string;
  } {
    if (!propertyOwners?.length) return {};
    
    const firstOwner = propertyOwners[0];
    return {
      owner_name: firstOwner.name || undefined,
      owner_email: firstOwner.email || firstOwner.work_email || undefined,
      owner_phone: firstOwner.phone || undefined
    };
  }

  /**
   * Mapea photos de Tokko a formato CreateImageDto 
   */
  private mapTokkoPhotosToImagesDto(photos: any[]): any[] {
    return photos.map(photo => ({
      url: photo.image || photo.original || '',
      description: photo.description || undefined,
      is_blueprint: photo.is_blueprint || false,
      order_position: photo.order || 0
    }));
  }

  // ========== API CALLS A TOKKO ==========

  // ========== FREEPORTAL-SPECIFIC MAPPING HELPERS ==========

  /**
   * Sanitizes "---" placeholder strings from the freeportal API to undefined.
   */
  private sanitizeDashValue(value: string | undefined): string | undefined {
    if (!value || value.trim() === '---') return undefined;
    return value;
  }

  /**
   * Maps freeportal flat operation_type string to OperationType enum.
   */
  private mapFreePortalOperationType(operationType: string | undefined): OperationType {
    if (!operationType) return OperationType.VENTA;
    const op = operationType.toLowerCase();
    if (op.includes('alquiler temporal')) return OperationType.ALQUILER_TEMPORAL;
    if (op.includes('alquiler')) return OperationType.ALQUILER;
    return OperationType.VENTA;
  }

  /**
   * Maps freeportal operation_category / operation_category_id to PropertyType enum.
   */
  private mapFreePortalPropertyType(category: string | undefined, categoryId: string | undefined): PropertyType {
    if (category) {
      const cat = category.toLowerCase();
      if (cat.includes('departamento') || cat.includes('apartment')) return PropertyType.DEPARTAMENTO;
      if (cat === 'ph') return PropertyType.PH;
      if (cat.includes('local')) return PropertyType.LOCAL_COMERCIAL;
      if (cat.includes('oficina')) return PropertyType.OFICINA_COMERCIAL;
      if (cat.includes('terreno') || cat.includes('lote')) return PropertyType.TERRENO;
      if (cat.includes('casa')) return PropertyType.CASA;
    }
    return PropertyType.CASA;
  }

  // ========== LOCATION HIERARCHY ==========

  /**
   * Given a Tokko location id, walks the parent chain in our locations table
   * and returns the correct ids for each hierarchy level:
   * sub_location_id, location_id, state_id, country_id.
   */
  async resolveLocationHierarchy(locationId: number): Promise<{
    location_id?: number;
    country_id?: number;
    state_id?: number;
    sub_location_id?: number;
  }> {
    const result: { location_id?: number; country_id?: number; state_id?: number; sub_location_id?: number } = {};
    let currentId: number | null = locationId;

    while (currentId != null) {
      const loc = await this.locationsService.findById(currentId);
      if (!loc) break;

      switch (loc.type) {
        case 'sub_location':
          result.sub_location_id = loc.id;
          break;
        case 'location':
          result.location_id = loc.id;
          break;
        case 'state':
          result.state_id = loc.id;
          break;
        case 'country':
          result.country_id = loc.id;
          currentId = null;
          continue;
        default:
          break;
      }

      currentId = loc.parent_id ?? null;
    }

    return result;
  }

  /**
   * Obtiene branches desde la API de Tokko
   * @param apikey API Key de Tokko
   * @returns Lista de branches de Tokko
   */
  async getBranches(apikey: string): Promise<any> {
    try {
      const url = `${this.TOKKO_BASE_URL}branch/?format=json&key=${apikey}`;
      
      console.log('Llamando a Tokko Branches API:', url);
      
      const response = await axios.get(url);
      
      if (!response.data) {
        console.log('No se recibieron datos de branches de Tokko');
        return { error: 'No data received from Tokko Branches API' };
      }

      const branches = response.data.objects || response.data;
      
      if (!Array.isArray(branches)) {
        console.log('Respuesta de Tokko branches no es un array');
        return { error: 'Invalid response format from Tokko Branches API' };
      }

      console.log(`Se recibieron ${branches.length} branches de Tokko`);

      return {
        success: true,
        count: branches.length,
        branches: branches,
        message: `Successfully retrieved ${branches.length} branches from Tokko`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error calling Tokko Branches API:', errorMessage);
      return {
        error: 'Failed to fetch branches from Tokko API',
        details: errorMessage
      };
    }
  }

  /**
   * Obtiene usuarios desde la API de Tokko
   * @param apikey API Key de Tokko
   * @returns Lista de usuarios de Tokko
   */
  async getUsers(apikey: string): Promise<any> {
    try {
      const url = `${this.TOKKO_BASE_URL}user/?format=json&key=${apikey}`;
      
      console.log('Llamando a Tokko Users API:', url);
      
      const response = await axios.get(url);
      
      if (!response.data) {
        console.log('No se recibieron datos de usuarios de Tokko');
        return { error: 'No data received from Tokko Users API' };
      }

      const users = response.data.objects || response.data;
      
      if (!Array.isArray(users)) {
        console.log('Respuesta de Tokko users no es un array');
        return { error: 'Invalid response format from Tokko Users API' };
      }

      console.log(`Se recibieron ${users.length} usuarios de Tokko`);

      return {
        success: true,
        count: users.length,
        users: users,
        message: `Successfully retrieved ${users.length} users from Tokko`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error calling Tokko Users API:', errorMessage);
      return {
        error: 'Failed to fetch users from Tokko API',
        details: errorMessage
      };
    }
  }

  /**
   * Crear organización completa desde datos de Tokko
   * @param apikey API Key de Tokko
   * @param partnersService Servicio de partners
   * @param partnerApiService Servicio de API de partners
   * @returns Resultado de la creación con estadísticas
   */
  async createOrganizationFromTokko(
    apikey: string, 
    partnersService: any, 
    partnerApiService: any
  ): Promise<any> {
    try {
      console.log('Iniciando creación de organización desde Tokko con API Key:', apikey);

      // 1. Obtener datos de branches y usuarios de Tokko
      const [branchesResult, usersResult] = await Promise.all([
        this.getBranches(apikey),
        this.getUsers(apikey)
      ]);

      // 2. Validar que ambas llamadas fueron exitosas
      if (branchesResult.error || usersResult.error) {
        return {
          error: 'Failed to fetch data from Tokko',
          branchesError: branchesResult.error,
          usersError: usersResult.error
        };
      }

      const branches = branchesResult.branches || [];
      const users = usersResult.users || [];

      if (!branches.length || !users.length) {
        return {
          error: 'No branches or users found in Tokko',
          branchesCount: branches.length,
          usersCount: users.length
        };
      }

      // 3. Obtener el partner "tokko"
      const tokkoPartner = await partnersService.findByName('tokko');
      if (!tokkoPartner) {
        return {
          error: 'Tokko partner not found. Please create the tokko partner first.'
        };
      }

      // 4. Preparar datos para crear organización con el primer branch y primer user
      const firstBranch = branches[0];
      const firstUser = users[0];

      const organizationDto = {
        company_name: firstBranch.name || firstBranch.display_name || 'Organización Tokko',
        company_logo: firstBranch.logo || undefined,
        email: firstBranch.email || firstUser.email,
        address: firstBranch.address || '',
        phone: firstBranch.phone || firstUser.phone || '',
        alternative_phone: firstBranch.alternative_phone || '',
        contact_time: firstBranch.contact_time || '',
        external_reference: firstBranch.id?.toString(),
        tokko_key: apikey, // Guardar el API key de Tokko
        admin_name: firstUser.name,
        admin_email: firstUser.email,
        admin_phone: firstUser.phone || firstBranch.phone || '',
        admin_avatar: firstUser.picture || undefined,
        admin_role_id: UserRole.USER_ROL_ADMIN,
        professional_type: ProfessionalType.INMOBILIARIO // Asumir un tipo profesional por defecto
      };

      // 5. Crear la organización inicial
      console.log('Creando organización con:', organizationDto);
      const orgResult = await partnerApiService.createOrganization(
        organizationDto as any,
        tokkoPartner
      );

      console.log('Organización creada exitosamente:', orgResult);

      const results = {
        organization_id: orgResult.organization_id,
        branch_id: orgResult.branch_id,
        admin_user_id: orgResult.admin_user_id,
        additional_branches: [] as any[],
        additional_users: [] as any[],
        summary: {
          total_branches: branches.length,
          total_users: users.length,
          created_additional_branches: 0,
          created_additional_users: 0
        }
      };

      // 6. Crear branches adicionales si existen
      if (branches.length > 1) {
        console.log(`Procesando ${branches.length - 1} branches adicionales...`);
        
        for (let i = 1; i < branches.length; i++) {
          try {
            const branch = branches[i];
            console.log(`Creando branch adicional ${i}: ${branch.name || branch.display_name}`);
            
            const additionalBranchDto = {
              branch_name: branch.name || branch.display_name || `Branch ${i + 1}`,
              email: branch.email || firstUser.email,
              phone: branch.phone || '',
              alternative_phone: branch.alternative_phone || '',
              contact_time: branch.contact_time || '',
              address: branch.address || '',
              external_reference: branch.id?.toString(),
              organization_id: orgResult.organization_id
            };

            // Crear branch usando BranchesService
            const createdBranch = await this.branchesService.create({
              ...additionalBranchDto,
              organizationId: orgResult.organization_id
            });
            
            console.log(`Branch adicional ${i} creado exitosamente con ID: ${createdBranch.id}`);
            
            results.additional_branches.push({
              tokko_data: branch,
              status: 'created',
              created_branch_id: createdBranch.id,
              dto: additionalBranchDto
            });
            
            results.summary.created_additional_branches++;

          } catch (error) {
            const errorMessage = (error as Error).message;
            console.error(`Error procesando branch adicional ${i} (${branches[i]?.name || 'N/A'}):`, errorMessage);
            results.additional_branches.push({
              tokko_data: branches[i],
              status: 'error',
              error: errorMessage
            });
          }
        }
      }

      // 7. Crear usuarios adicionales si existen
      if (users.length > 1) {
        console.log(`Procesando ${users.length - 1} usuarios adicionales...`);
        
        for (let i = 1; i < users.length; i++) {
          try {
            const user = users[i];
            
            // Generar password temporal consistente
            const tempPassword = user.email; // Usar email como password temporal
            
            const additionalUserDto = {
              name: user.name,
              email: user.email,
              password: tempPassword,
              phone: user.phone || '',
              avatar: user.picture || undefined,
              external_reference: user.id?.toString(),
              role_id: UserRole.USER_ROL_COLLABORATOR,
              organizationId: orgResult.organization_id,
              branchIds: [orgResult.branch_id]
            };

            console.log(`Creando usuario adicional ${i}: ${user.name} (${user.email})`);
            
            // Crear user usando UsersService
            const createdUser = await this.usersService.create(additionalUserDto);

            console.log(`Usuario adicional ${i} creado exitosamente con ID: ${createdUser.id}`);

            results.additional_users.push({
              tokko_data: user,
              status: 'created',
              created_user_id: createdUser.id,
              temp_password: tempPassword,
              dto: additionalUserDto
            });

            results.summary.created_additional_users++;

          } catch (error) {
            const errorMessage = (error as Error).message;
            console.error(`Error procesando usuario adicional ${i} (${users[i]?.name || 'N/A'}):`, errorMessage);
            results.additional_users.push({
              tokko_data: users[i],
              status: 'error',
              error: errorMessage
            });
          }
        }
      }

      return {
        success: true,
        message: 'Organization created successfully from Tokko data',
        data: results,
        tokko_source: {
          branches: branchesResult,
          users: usersResult
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error creating organization from Tokko:', errorMessage);
      return {
        error: 'Failed to create organization from Tokko data',
        details: errorMessage
      };
    }
  }

  /**
   * Obtiene y procesa propiedades desde la API de Tokko con paginación
   * @param apikey API Key de Tokko
   * @param limit Número de propiedades por página (default: 20)
   * @param offset Desplazamiento para paginación (default: 0) 
   * @returns Resultado del procesamiento con estadísticas y paginación
   */
  async getProperties(apikey: string, limit: number = 20, offset: number = 0): Promise<any> {
    try {
      const url = `${this.TOKKO_BASE_URL}property/?lang=es_ar&format=json&key=${apikey}&limit=${limit}&offset=${offset}`;
      
      console.log('Llamando a Tokko API:', url);
      
      const response = await axios.get(url);
      
      if (!response.data) {
        console.log('No se recibieron datos de Tokko');
        return { error: 'No data received from Tokko API' };
      }

      const meta = response.data.meta || {};
      const properties = response.data.objects || response.data;
      
      if (!Array.isArray(properties)) {
        console.log('Respuesta de Tokko no es un array');
        return { error: 'Invalid response format from Tokko API' };
      }

      console.log(`Se recibieron ${properties.length} propiedades de Tokko (${offset + 1}-${offset + properties.length} de ${meta.total_count || 'N/A'})`);
      
      // Estadísticas de procesamiento
      const stats = {
        propiedades_creadas: 0,
        propiedades_ignoradas: 0,
        propiedades_con_error: 0,
        total_procesadas: 0
      };

      const processedProperties: any[] = [];
      const errors: any[] = [];

      // Procesar cada propiedad individualmente
      if (properties.length > 0) {

        const organizationData = await this.organizationsService.getOrganizationWithRelations({
            tokko_key: apikey
        });

        if (organizationData.error || !organizationData.organization) {
          console.log('No se pudo cargar información de la organización con el apikey indicado:' + apikey, organizationData.error);
          return {
            error: 'Organization not found or failed to load',
            details: organizationData.error
          };
        }

        // Crear mapas por external_reference para búsqueda rápida en mapeo de Tokko
        const branchesMap = new Map<string, any>();
        const usersMap = new Map<string, any>();

        // Mapear branches por external_reference (Tokko branch.id -> nuestra branch)
        if (organizationData.branches) {
          organizationData.branches.forEach(branch => {
            if (branch.external_reference) {
              branchesMap.set(branch.external_reference, branch);
            }
          });
        }

        // Mapear users por external_reference (Tokko user.id -> nuestro user)
        if (organizationData.users) {
          organizationData.users.forEach(user => {
            if (user.external_reference) {
              usersMap.set(user.external_reference, user);
            }
          });
        }

        console.log(`Organización: ${organizationData.organization.company_name} (ID: ${organizationData.organization.id})`);

        console.log('=== PROCESANDO PROPIEDADES TOKKO ===');
        
        for (let i = 0; i < properties.length; i++) {
          const property = properties[i];
          const propertyNumber = offset + i + 1;
          
          console.log(`\n=== PROPIEDAD ${propertyNumber} - PROCESANDO ===`);
          
          try {
            // Verificar si la propiedad ya existe por reference_code
            const referenceCode = property.reference_code;
            let propertyExists = false;
            
            if (referenceCode) {
              try {
                await this.propertiesService.findByReferenceCode(referenceCode);
                propertyExists = true;
                console.log(`Propiedad ${propertyNumber} (${referenceCode}) ya existe - IGNORADA`);
              } catch (error) {
                // NotFoundException significa que no existe, continuamos con el procesamiento
                propertyExists = false;
              }
            }
            
            if (propertyExists) {
              stats.propiedades_ignoradas++;
              processedProperties.push({
                tokko_data: property,
                status: 'ignored',
                reference_code: referenceCode,
                reason: 'Property already exists'
              });
            } else {
              // Mapear la propiedad al formato Metroprop usando la información pre-cargada
              console.log(`Mapeando propiedad ${propertyNumber}...`);

              const mappedProperty = await this.mapToMetropropFormat(property, {
                organization: organizationData.organization,
                branchesMap: branchesMap,
                usersMap: usersMap
              });

              console.log(`Propiedad ${propertyNumber} mapeada exitosamente`);
              console.log('Propiedad mapeada:', JSON.stringify(mappedProperty, null, 2));

              // Crear la propiedad en la base de datos
              console.log(`Creando propiedad ${propertyNumber} en base de datos...`);
              const createdProperty = await this.propertiesService.create(mappedProperty as CreatePropertyDto);
              console.log(`Propiedad ${propertyNumber} creada exitosamente con ID: ${createdProperty.data.id}`);

              stats.propiedades_creadas++;
              processedProperties.push({
                tokko_data: property,
                status: 'created',
                reference_code: referenceCode,
                mapped_property: mappedProperty,
                created_property_id: createdProperty.data.id
              });
            }
            
            stats.total_procesadas++;
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
            console.error(`Error procesando propiedad ${propertyNumber}:`, errorMessage);
            
            stats.propiedades_con_error++;
            stats.total_procesadas++;
            
            errors.push({
              property_number: propertyNumber,
              tokko_data: property,
              error: errorMessage
            });
            
            processedProperties.push({
              tokko_data: property,
              status: 'error',
              reference_code: property.reference_code || 'N/A',
              error: errorMessage
            });
          }
        }
        
        console.log('\n=== FIN PROCESAMIENTO ===');
        console.log('Estadísticas:', stats);
      } else {
        console.log('No se encontraron propiedades en la respuesta');
      }

      // Preparar respuesta con paginación
      const hasNext = !!meta.next;
      const nextUrl = meta.next ? `${this.TOKKO_BASE_URL.replace('/api/v1/', '')}${meta.next}` : null;

      return {
        success: true,
        pagination: {
          limit,
          offset,
          total_count: meta.total_count || 0,
          has_next: hasNext,
          next_url: nextUrl,
          next_offset: hasNext ? offset + limit : null
        },
        statistics: stats,
        processed_properties: processedProperties,
        errors: errors.length > 0 ? errors : undefined,
        message: `Processed ${stats.total_procesadas} properties: ${stats.propiedades_creadas} created, ${stats.propiedades_ignoradas} ignored, ${stats.propiedades_con_error} errors`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error calling Tokko API:', errorMessage);
      return {
        error: 'Failed to fetch properties from Tokko API',
        details: errorMessage
      };
    }
  }

  // ========== FREEPORTALS API METHODS ==========

  /**
   * Calls the Tokko freeportals feed endpoint with pagination.
   * Pass `organizationId` to filter results to a single company (maps to `company_id` query param).
   */
  async fetchFreePortalProperties(
    apiKey: string,
    limit: number = 10,
    offset: number = 0,
    dateFrom: string = '2000-01-01T00:00:00',
    organizationId?: string,
  ): Promise<{ objects: any[]; meta: any } | { error: string; details?: string }> {
    try {
      let url =
        `https://tokkobroker.com/portals/simple_portal/api/v1/freeportals/` +
        `?api_key=${encodeURIComponent(apiKey)}&format=json&lang=es-MX` +
        `&filter=updated&date_from=${encodeURIComponent(dateFrom)}` +
        `&limit=${limit}&offset=${offset}`;

      if (organizationId) {
        url += `&company_id=${encodeURIComponent(organizationId)}`;
      }

      console.log(`[TokkoHelper] fetchFreePortalProperties offset=${offset}, limit=${limit}, from=${dateFrom}${organizationId ? `, org=${organizationId}, url=${url}` : ''}`);
      const response = await axios.get(url, { timeout: 30000 });

      if (!response.data) {
        return { error: 'No data received from freeportals endpoint' };
      }

      return {
        objects: response.data.objects || [],
        meta: response.data.meta || {},
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[TokkoHelper] fetchFreePortalProperties error:', errorMessage);
      return { error: 'Failed to fetch freeportal properties', details: errorMessage };
    }
  }

  /**
   * Fetches a single freeportal property by publication_id from the detail endpoint.
   * No date filter — always returns current data regardless of update date.
   */
  async fetchFreePortalPropertyById(
    apiKey: string,
    publicationId: string,
  ): Promise<{ item: any } | { error: string; details?: string; notFound?: boolean }> {
    
    const url =
        `https://tokkobroker.com/portals/simple_portal/api/v1/freeportals/` +
        `?api_key=${encodeURIComponent(apiKey)}&publication_id=${encodeURIComponent(publicationId)}&format=json&lang=es-MX`;

    try { 
      console.log(`[TokkoHelper] fetchFreePortalPropertyById publication_id=${publicationId}`);
      const response = await axios.get(url, { timeout: 30000 });

      // The endpoint always returns a paginated list format even when filtering by publication_id
      const objects: any[] = response.data?.objects ?? [];
      const item = objects.find(
        (o: any) => o.publication_id != null && String(o.publication_id) === publicationId,
      ) ?? objects[0];

      if (!item || !item.publication_id) {
        return { error: 'Empty or invalid response from freeportals detail endpoint', notFound: true };
      }

      return { item };
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return { error: `publication_id ${publicationId} not found`, notFound: true };
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[TokkoHelper] fetchFreePortalPropertyById error:', errorMessage);
      return { error: 'Failed to fetch freeportal property by id ' + url, details: errorMessage };
    }
  }

  /**
   * Normalizes the freeportal tag dict format to a flat array for processTokkoTags.
   * Input:  { "Servicios": ["WiFi", "Gas"], "Adicionales": ["Luminoso"] }
   * Output: [{ name: "WiFi", type: "Servicios" }, { name: "Gas", type: "Servicios" }, ...]
   */
  normalizeFreePortalTags(tags: Record<string, string[]>): Array<{ name: string; type: string }> {
    if (!tags || typeof tags !== 'object') return [];
    const result: Array<{ name: string; type: string }> = [];
    for (const [type, names] of Object.entries(tags)) {
      if (Array.isArray(names)) {
        names.forEach(name => {
          if (name && typeof name === 'string') {
            result.push({ name: name.trim(), type });
          }
        });
      }
    }
    return result;
  }

  /**
   * Maps a freeportal property item to Metroprop format.
   * Tags come as { type: [names] } dict and are resolved by partner_tag_name only.
   */
  async mapFreePortalPropertyToMetropropFormat(
    item: any,
    orgId: number,
    branchId: number,
    userId?: number,
  ): Promise<TokkoToMetropropResponse> {
    // Normalize and process tags by name only (freeportals has no tag IDs)
    const normalizedTags = this.normalizeFreePortalTags(item.tags || {});
    const { mappedTagIds, unmappedTags: rawUnmapped } = normalizedTags.length
      ? await this.tagsService.processTokkoTags(normalizedTags)
      : { mappedTagIds: [], unmappedTags: [] };

    const categorizedUnmapped = rawUnmapped.map(t => ({
      ...t,
      category: this.categorizeTag(t.type),
    }));
    const unmappedTagsDescription = this.generateUnmappedTagsDescription(categorizedUnmapped);

    const hasSign = this.extractHasSignFromCustomTags(item.custom_tags || []);

    const rawLocationId: number | undefined = item.operation_location_id ?? item.location?.id ?? undefined;
    const locationHierarchy = rawLocationId
      ? await this.resolveLocationHierarchy(rawLocationId)
      : {};

    const mapped: TokkoToMetropropResponse = {
      // Freeportals-specific identifiers
      tokko_id: item.tokko_id != null ? String(item.tokko_id) : (item.id != null ? String(item.id) : undefined),
      publication_id: item.publication_id != null ? String(item.publication_id) : undefined,
      reference_code: item.reference_code || `TOKKO-${item.publication_id ?? item.tokko_id ?? item.id ?? Date.now()}`,
      publication_title: item.publication_title || item.title || '',

      property_type: item.operation_category != null
        ? this.mapFreePortalPropertyType(item.operation_category, item.operation_category_id)
        : this.mapTokkoPropertyTypeToEnum(item.type),
      status: this.mapTokkoStatusToEnum(item.status),
      operation_type: item.operation_type != null && item.operations == null
        ? this.mapFreePortalOperationType(item.operation_type)
        : this.mapTokkoOperationTypeToEnum(item.operations),
      price: item.operations == null ? (item.operation_amount ?? 0) : this.extractPriceFromOperations(item.operations),
      currency: item.operations == null
        ? ((item.operation_currency ?? Currency.USD) as Currency)
        : (this.extractCurrencyFromOperations(item.operations) as Currency),

      description: this.combineDescription(
        item.description || item.rich_description,
        unmappedTagsDescription,
      ),

      age: item.age || undefined,
      bathroom_amount: item.bathroom_amount || undefined,
      floor: item.floor || undefined,
      floors_amount: item.floors_amount || undefined,
      geo_lat: this.parseNumericString(item.geo_lat),
      geo_long: this.parseNumericString(item.geo_long),
      parking_lot_amount: item.parking_lot_amount || undefined,
      property_condition: this.sanitizeDashValue(item.property_condition),
      room_amount: item.room_amount || undefined,
      situation: this.sanitizeDashValue(item.situation),
      suite_amount: item.suite_amount || undefined,
      toilet_amount: item.toilet_amount || undefined,
      zonification: item.zonification || undefined,
      expenses: item.expenses || undefined,
      transaction_requirements: item.transaction_requirements || undefined,
      development: item.development || undefined,

      street: item.address || item.real_address || item.fake_address || undefined,
      apartment: item.apartment_door || undefined,
      apartments_per_floor: item.appartments_per_floor || undefined,
      garage_coverage: this.mapTokkoGarageCoverage(item),
      surface_length: this.parseIntegerString(item.depth_measure),
      surface_front: this.parseIntegerString(item.front_measure),
      dispositions: this.mapTokkoDisposition(item.disposition),
      number_of_guests: item.guests_amount || undefined,

      surface: this.parseNumericString(item.surface) ?? this.parseNumericString(item.land),
      roofed_surface: this.parseNumericString(item.roofed_surface),
      unroofed_surface: this.parseNumericString(item.unroofed_surface),
      semiroofed_surface: this.parseNumericString(item.semiroofed_surface),
      total_surface: this.parseNumericString(item.total_surface),
      surface_measurement: this.mapTokkoSurfaceMeasurement(item.surface_measurement ?? item.land_measurement),

      orientation: this.mapTokkoOrientation(item.orientation),
      credit_eligible: this.mapTokkoStringToBoolean(item.credit_eligible),
      has_sign: hasSign,

      ...locationHierarchy,
      postal_code: item.zipcode ?? item.location?.zip_code ?? undefined,
      period: item.operations != null ? this.extractPeriodFromOperations(item.operations) : undefined,

      organization_id: orgId,
      branch_id: branchId,
      user_id: userId,

      images: this.mapFreePortalPhotos(item.photos || []),
      videos: this.mapTokkoVideos(item.videos || []),
      attached: this.mapTokkoFiles(item.files || []),
      tags: mappedTagIds,
    };

    return mapped;
  }

  /**
   * Maps freeportal photos to image DTO, preserving original URL in original_image.
   */
  mapFreePortalPhotos(photos: any[]): Array<{
    url: string;
    original_image: string;
    description?: string;
    is_blueprint?: boolean;
    order_position?: number;
  }> {
    return photos.map(photo => ({
      url: photo.original || photo.image || '',
      original_image: photo.original || photo.image || '',
      description: photo.description || undefined,
      is_blueprint: photo.is_blueprint || false,
      order_position: photo.order || 0,
    }));
  }
}
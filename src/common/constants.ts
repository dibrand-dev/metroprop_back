import { PropertyType, PropertySubtype } from './enums';


export const PASSWORD_DEFAULT = 'demo'; // Contraseña por defecto para usuarios creados desde registro profesional. Cambiar a algo más seguro en producción.

/**
 * Mapa de subtipos válidos por tipo de propiedad.
 * Los tipos sin subtipos no aparecen en el mapa (o tienen array vacío).
 * Usarlo para validar, generar selects en el front, etc.
 */
export const PROPERTY_SUBTYPES_BY_TYPE: Partial<Record<PropertyType, PropertySubtype[]>> = {
  [PropertyType.CASA]: [
    PropertySubtype.BUNGALOW,
    PropertySubtype.CABANA,
    PropertySubtype.CHALET,
    PropertySubtype.CONDOMINIO,
    PropertySubtype.DUPLEX,
    PropertySubtype.TRIPLEX,
    PropertySubtype.CASA_DE_PLAYA,
    PropertySubtype.PH,
    PropertySubtype.PREFABRICADA,
  ],
  [PropertyType.DEPARTAMENTO]: [
    PropertySubtype.APARTESTUDIO,
    PropertySubtype.DUPLEX,
    PropertySubtype.LOFT,
    PropertySubtype.PENTHOUSE,
    PropertySubtype.PISO,
    PropertySubtype.SEMIPISO,
    PropertySubtype.TRIPLEX,
    PropertySubtype.ESTANDAR,
  ],
  [PropertyType.BOVEDA_NICHO_PARCELA]: [
    PropertySubtype.BOVEDA,
    PropertySubtype.NICHO,
    PropertySubtype.PARCELA,
  ],
};

/**
 * IDs de tags disponibles por tipo de propiedad.
 * Referencia: database/seed-tags.sql
 */
export const TAGS_BY_PROPERTY_TYPE: Record<PropertyType, number[]> = {
  // ── Casa ────────────────────────────────────────────────────────────────
  [PropertyType.CASA]: [ ],
  // ── Departamento ────────────────────────────────────────────────────────
  [PropertyType.DEPARTAMENTO]: [ ],
  // ── Terreno ─────────────────────────────────────────────────────────────
  [PropertyType.TERRENO]: [],
  // ── PH ──────────────────────────────────────────────────────────────────
  [PropertyType.PH]: [ ],
  // ── Galpón / Bodega ─────────────────────────────────────────────────────
  [PropertyType.GALPON_BODEGA]: [ ],
  // ── Bóveda / Nicho / Parcela ─────────────────────────────────────────────
  [PropertyType.BOVEDA_NICHO_PARCELA]: [ ],
  // ── Cama náutica ────────────────────────────────────────────────────────
  [PropertyType.CAMA_NAUTICA]: [ ],
  // ── Campo ───────────────────────────────────────────────────────────────
  [PropertyType.CAMPO]: [ ],
  // ── Consultorio ─────────────────────────────────────────────────────────
  [PropertyType.CONSULTORIO]: [ ],
  // ── Depósito ────────────────────────────────────────────────────────────
  [PropertyType.DEPOSITO]: [ ],
  // ── Edificio ────────────────────────────────────────────────────────────
  [PropertyType.EDIFICIO]: [ ],
  // ── Fondo de comercio ───────────────────────────────────────────────────
  [PropertyType.FONDO_DE_COMERCIO]: [ ],
  // ── Garage ──────────────────────────────────────────────────────────────
  [PropertyType.GARAGE]: [ ],
  // ── Hotel ───────────────────────────────────────────────────────────────
  [PropertyType.HOTEL]: [ ],
  // ── Local comercial ─────────────────────────────────────────────────────
  [PropertyType.LOCAL_COMERCIAL]: [ ],
  // ── Oficina comercial ───────────────────────────────────────────────────
  [PropertyType.OFICINA_COMERCIAL]: [ ],
  // ── Quinta vacacional ───────────────────────────────────────────────────
  [PropertyType.QUINTA_VACACIONAL]: [ ],
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMPOS DE "DETALLES DE LA PROPIEDAD" POR TIPO
// ─────────────────────────────────────────────────────────────────────────────
export const FIELDS_BY_PROPERTY_TYPE: Record<PropertyType, string[]> = {
  // ── Casa ─────────────────────────────────────────────────────────────────
  [PropertyType.CASA]: [
    'brightness',
    'orientation',
    'floors_amount',
    'garage_coverage',
    'surface_front',
    'surface_length',
    'semiroofed_surface',
  ],
  // ── Departamento ─────────────────────────────────────────────────────────
  [PropertyType.DEPARTAMENTO]: [
    'brightness',
    'orientation',
    'dispositions',
    'floors_amount',         // Cantidad de plantas del edificio
    'garage_coverage',
    'semiroofed_surface',
    'apartments_per_floor',  // Departamentos por piso
  ],
  // ── Terreno ──────────────────────────────────────────────────────────────
  [PropertyType.TERRENO]: [
    'surface_front',
    'surface_length',
    'fot',                   // F.O.T. - Factor de Ocupación Total
  ],
  // ── PH ───────────────────────────────────────────────────────────────────
  [PropertyType.PH]: [
    'brightness',
    'orientation',
    'dispositions',
    'floors_amount',
    'garage_coverage',
    'surface_front',
    'surface_length',
    'semiroofed_surface',
  ],
  // ── Galpón / Bodega ──────────────────────────────────────────────────────
  [PropertyType.GALPON_BODEGA]: [
    'floors_amount',
    'garage_coverage',
    'surface_front',
    'surface_length',
    'warehouse_units',       // Cantidad de naves
  ],
  // ── Bóveda / Nicho / Parcela ─────────────────────────────────────────────
  [PropertyType.BOVEDA_NICHO_PARCELA]: [
    // Sin campos de detalle específicos identificados en los wireframes
  ],
  // ── Cama náutica ─────────────────────────────────────────────────────────
  [PropertyType.CAMA_NAUTICA]: [
    // Sin campos de detalle específicos identificados en los wireframes
  ],
  // ── Campo ────────────────────────────────────────────────────────────────
  [PropertyType.CAMPO]: [
    'surface_front',
    'surface_length',
    'surface_measurement',   // Unidad de medida (M2 / HA)
    'total_surface',
  ],
  // ── Consultorio ──────────────────────────────────────────────────────────
  [PropertyType.CONSULTORIO]: [
    'floors_amount',
    'garage_coverage',
    'business_type',      // Tipo de rubro
  ],
  // ── Depósito ─────────────────────────────────────────────────────────────
  [PropertyType.DEPOSITO]: [
    'floors_amount',
    'garage_coverage',
    'surface_front',
    'surface_length',
  ],
  // ── Edificio ─────────────────────────────────────────────────────────────
  [PropertyType.EDIFICIO]: [
    'brightness',
    'orientation',
    'dispositions',
    'floors_amount',         // Cantidad de pisos en edificio
    'garage_coverage',
    'semiroofed_surface',
    'apartments_per_floor',  // Departamentos por piso
  ],
  // ── Fondo de comercio ────────────────────────────────────────────────────
  [PropertyType.FONDO_DE_COMERCIO]: [
    'surface_front',
    'surface_length',
    'business_type',      // Tipo de rubro
  ],
  // ── Garage ───────────────────────────────────────────────────────────────
  [PropertyType.GARAGE]: [
    'garage_coverage',
  ],
  // ── Hotel ────────────────────────────────────────────────────────────────
  [PropertyType.HOTEL]: [
    'floors_amount',
    'garage_coverage',
    'number_of_guests',      // Cantidad de huéspedes
  ],
  // ── Local comercial ──────────────────────────────────────────────────────
  [PropertyType.LOCAL_COMERCIAL]: [
    'floors_amount',
    'surface_front',
    'surface_length',
    'business_type',      // Tipo de rubro
  ],
  // ── Oficina comercial ────────────────────────────────────────────────────
  [PropertyType.OFICINA_COMERCIAL]: [
    'floors_amount',
    'surface_front',
    'surface_length',
    'business_type',      // Tipo de rubro
  ],
  // ── Quinta vacacional ────────────────────────────────────────────────────
  [PropertyType.QUINTA_VACACIONAL]: [
    'garage_coverage',
    'number_of_guests',      // Cantidad de huéspedes
  ],
};

const RUBROS = [
  "Aberturas",
  "Agencia",
  "Agencia comercial",
  "Albergue transitorio",
  "Almacén",
  "Antigüedades",
  "Artículos de limpieza",
  "Astillero",
  "Autoservicio",
  "Balnearios",
  "Bar",
  "Bazar",
  "Bicicletería",
  "Bijouterie",
  "Bombonería",
  "Boutique",
  "Bowling",
  "Cabañas",
  "Café concert",
  "Cafetería",
  "Carnicería",
  "Carpintería",
  "Casa de comidas",
  "Casa de repuestos",
  "Centro de copiado",
  "Centro de estética",
  "Centro médico",
  "Cerrajería",
  "Cervecería",
  "Churrería",
  "Ciber",
  "Cigarrería",
  "Clínica",
  "Club",
  "Colegio",
  "Comercio",
  "Complejo de cabañas",
  "Complejo de calzado",
  "Computación",
  "Confitería",
  "Corralón",
  "Cotillón",
  "Criadero",
  "Cuadra",
  "Delivery",
  "Despacho de pan",
  "Despensa",
  "Dietética",
  "Discoteca",
  "Droguería",
  "Drugstore",
  "Dulcería",
  "Empanadas",
  "Empresa",
  "Escuela",
  "Estación de servicio",
  "Estacionamiento",
  "Fábrica",
  "Fábrica de pastas",
  "Fábrica de tortas",
  "Farmacia",
  "Ferretería",
  "Fiambrería",
  "Florería",
  "Forrajería",
  "Fotografía",
  "Franquicias",
  "Frigorífico",
  "Frutería",
  "Fútbol 5",
  "Garage",
  "Gastronomía",
  "Geriátrico",
  "Gimansio",
  "Gomería",
  "Granja",
  "Guardamuebles",
  "Guardería",
  "Heladería",
  "Hostel",
  "Hotel",
  "Imprenta",
  "Inmobiliaria",
  "Instituto",
  "Jardín de infantes",
  "Joyería",
  "Juguetería",
  "Kiosco",
  "Laboratorio",
  "Lavadero de autos",
  "Lavadero de ropa",
  "Lencería",
  "Librería",
  "Licorería",
  "Locutorio",
  "Lotería",
  "Lubricentro",
  "Marmolería",
  "Marroquinería",
  "Maxikiosco",
  "Mensajería",
  "Mercería",
  "Minimercado",
  "Mueblería",
  "Negocio",
  "Óptica",
  "Paddle",
  "Panadería",
  "Panchería",
  "Pañalera",
  "Papelera",
  "Parada de diarios",
  "Parrilla",
  "Pastelería",
  "Patio cervecero",
  "Pelotero",
  "Peluquería",
  "Perfumería",
  "Pescadería",
  "Petshop",
  "Pinturería",
  "Pizzería",
  "Polideportivo",
  "Polirubro",
  "Pollería",
  "Prode",
  "Pub",
  "Quesería",
  "Quiniela",
  "Receptoría",
  "Regalería",
  "Remisería",
  "Reparto",
  "Repostería",
  "Restaurante",
  "Restobar",
  "Rodados",
  "Ropa",
  "Rotisería",
  "Sala de ensayo",
  "Salón de belleza",
  "Salón de eventos",
  "Salón de fiestas",
  "Sandwichería",
  "Sedería",
  "Solarium",
  "Supermercado",
  "Talabartería",
  "Taller",
  "Taller mecánico",
  "Teatro",
  "Tintorería",
  "Transporte",
  "Venta de materiales",
  "Verdulería",
  "Veterinaria",
  "Videoclub",
  "Vidriería",
  "Vinoteca",
  "Vivero",
  "Zapatería",
  "Zapatillería",
  "Zinguería",
  "Otro"
];




export const PROPERTY_IMAGE_FOLDER = 'properties';
export const USER_IMAGE_FOLDER = 'users';
export const ORGANIZATION_IMAGE_FOLDER = 'organizations';
export const PARTNER_IMAGE_FOLDER = 'partners';
export const BRANCH_IMAGE_FOLDER = 'branches';
export const DEFAULT_IMAGE_ORDER = 0;
export const MAX_IMAGE_SIZE_MB = 5;

export const PROPERTY_STATUS = { 
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DRAFT: 'draft',
};

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// 🔗 API Endpoints
export const API_ENDPOINTS = {
  PRODUCTION: 'https://api.metroprop.co',
  DEVELOPMENT: 'http://localhost:3000',
} as const;


// 🎯 Current API Base URL
export const API_BASE_URL = IS_PRODUCTION 
  ? API_ENDPOINTS.PRODUCTION 
  : API_ENDPOINTS.DEVELOPMENT;

// =============================================
// IMAGE PROCESSING SIZES
// Para agregar un nuevo tamaño, añadir una entrada aquí con su propio prefix.
// El prefix se antepone al nombre del archivo base en S3.
// Ejemplo para agregar medium: MEDIUM: { width: 1200, prefix: 'medium_' }
// =============================================
export const THUMB_PREFIX = 'thumb_';
export const MEDIUM_PREFIX = 'medium_';

export const IMAGE_SIZES = {
  FULL:  { width: 2000, prefix: '' },
  THUMB: { width: 300,  prefix: THUMB_PREFIX },
  MEDIUM: { width: 700, prefix: MEDIUM_PREFIX },
} as const;

export type ImageSizeKey = keyof typeof IMAGE_SIZES;

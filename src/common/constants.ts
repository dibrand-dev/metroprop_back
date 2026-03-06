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

export const IMAGE_SIZES = {
  FULL:  { width: 2000, prefix: '' },
  THUMB: { width: 600,  prefix: THUMB_PREFIX },
  // MEDIUM: { width: 1200, label: 'medium' },
} as const;

export type ImageSizeKey = keyof typeof IMAGE_SIZES;

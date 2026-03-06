/**
 * Tipos de operación para una propiedad.
 */
export enum OperationType {
  VENTA = 1,
  ALQUILER = 2,
  ALQUILER_TEMPORAL = 3,
}

/**
 * Tipos principales de propiedad.
 */
export enum PropertyType {
  LAND = 1,               // Terreno
  APARTMENT = 2,          // Departamento
  HOUSE = 3,              // Casa
  WEEKEND_HOUSE = 4,      // Casa de fin de semana
  OFFICE = 5,             // Oficina
  MOORING = 6,            // Amarre
  BUSINESS_PREMISES = 7,  // Local comercial
  COMMERCIAL_BUILDING = 8, // Edificio comercial
  COUNTRYSIDE = 9,        // Campo
  GARAGE = 10,            // Garage
  HOTEL = 11,             // Hotel
  INDUSTRIAL_SHIP = 12,   // Nave industrial
  CONDO = 13,             // Condominio
  STORAGE = 14,           // Depósito
  BUSINESS_PERMIT = 15,   // Habilitación comercial
  STORAGE_ROOM = 16,      // Trastero
  BODEGAS = 17,           // Bodegas
  FINCAS = 18,            // Fincas
  CHACRA = 19,            // Chacra
  CAMA_NAUTICA = 20,      // Cama náutica
  ISLA = 21,              // Isla
  TERRAZA = 23,           // Terraza
  GALPON = 24,            // Galpón
}

/**
 * Subtipos de propiedad.
 * Estos son ejemplos, puedes ajustarlos según tus necesidades.
 */
export enum PropertySubtype {
  DUPLEX = 1,
  TRIPLEX = 2,
  LOFT = 3,
  PISO_UNICO = 4,
  PENTHOUSE = 5,
}

/**
 * Estados de la propiedad.
 */
export enum PropertyStatus {
  DRAFT = 0,        // Borrador (oculto para usuarios)
  A_COTIZAR = 1,     // A cotizar
  DISPONIBLE = 2,    // Disponible (default)
  RESERVADA = 3,     // Reservada
  NO_DISPONIBLE = 4, // No disponible
}

/**
 * Estados de multimedia (imágenes/archivos) durante el proceso de upload.
 * Para tracking del proceso asíncrono de subida a S3.
 */
export enum MediaUploadStatus {
  PENDING = 'pending',       // Esperando ser procesado
  UPLOADING = 'uploading',   // En proceso de subida a S3
  COMPLETED = 'completed',   // Subido exitosamente
  FAILED = 'failed',         // Error en la subida
  RETRYING = 'retrying',     // Reintentando después de error
}

/**
 * Tipos de tags para categorización.
 */
export enum TagType {
  TAG_TYPE_AMENITY = 1,    // Comodidades (piscina, gym, etc.)
  TAG_TYPE_SERVICES = 2,   // Servicios (seguridad, portero, etc.)
  TAG_TYPE_ROOM = 3,       // Tipos de habitaciones (dormitorio en suite, etc.)
}

/**
 * Luminosidad de la propiedad.
 */
export enum Brightness {
  VERY_BRIGHT = 1,  // Muy luminoso
  BRIGHT = 2,       // Luminoso
  DIM = 3,          // Poco luminoso
}

/**
 * Cobertura de garage/cochera.
 */
export enum GarageCoverage {
  COVERED = 1,       // Cubierta
  SEMI_COVERED = 2,  // Semi cubierta
  UNCOVERED = 3,     // Descubierta
}

/**
 * Orientación de la propiedad.
 */
export enum Orientation {
  SELECCIONAR = 0,  // seleccionar
  SUR = 1,          // sur
  NORTE = 2,        // norte
  OESTE = 3,        // oeste
  ESTE = 4,         // este
  SUDESTE = 5,      // sudeste
  NORESTE = 6,      // noreste
  SUDOESTE = 7,     // sudoeste
  NOROESTE = 8,     // noroeste
}

/**
 * Disposición de la propiedad.
 */
export enum Disposition {
  SELECCIONAR = 0,   // seleccionar
  CONTRAFRENTE = 1,  // contrafrente
  FRENTE = 2,        // frente
  INTERNO = 3,       // interno
  LATERAL = 4,       // lateral
}

/**
 * Unidades de medida de superficie.
 */
export enum SurfaceMeasurement {
  M2 = 'M2',  // Metro cuadrado (default)
  HA = 'HA',  // Hectáreas
}

/**
 * Monedas disponibles.
 */
export enum Currency {
  USD = 'USD',  // Dólar
  ARS = 'ARS',  // Peso Argentino
  PYG = 'PYG',  // Guaraní
  UYU = 'UYU',  // Peso Uruguayo
  PEN = 'PEN',  // Sol Peruano
}

/**
 * Períodos para alquiler temporal (solo para OperationType.ALQUILER_TEMPORAL).
 */
export enum TemporalRentPeriod {
  SELECCIONAR = 0,                    // seleccionar
  POR_DIA = 1,                        // Por día
  POR_FIN_DE_SEMANA = 2,             // Por fin de semana
  POR_SEMANA = 3,                     // Por semana
  QUINCENA = 4,                       // Quincena
  MES = 5,                            // Mes
  PRIMER_QUINCENA_ENERO = 6,          // 1er quincena de enero
  SEGUNDA_QUINCENA_ENERO = 7,         // 2da quincena de enero
  PRIMER_QUINCENA_FEBRERO = 8,        // 1er quincena de febrero
  SEGUNDA_QUINCENA_FEBRERO = 9,       // 2da quincena de febrero
  PRIMER_QUINCENA_MARZO = 10,         // 1er quincena de marzo
  SEGUNDA_QUINCENA_MARZO = 11,        // 2da quincena de marzo
  ENERO = 12,                         // Enero
  FEBRERO = 13,                       // Febrero
  MARZO = 14,                         // Marzo
  ABRIL = 15,                         // Abril
  MAYO = 17,                          // Mayo
  JUNIO = 18,                         // Junio
  JULIO = 19,                         // Julio
  AGOSTO = 20,                        // Agosto
  SEPTIEMBRE = 21,                    // Septiembre
  OCTUBRE = 22,                       // Octubre
  NOVIEMBRE = 23,                     // Noviembre
  DICIEMBRE = 24,                     // Diciembre
  POR_TEMPORADA = 25,                 // Por temporada
  POR_ANO = 26,                       // Por año
  FIN_DE_ANO = 27,                    // Fin de año
  SEMANA_SANTA = 28,                  // Semana santa
  PRIMER_QUINCENA_DICIEMBRE = 29,     // 1er quincena de diciembre
  SEGUNDA_QUINCENA_DICIEMBRE = 30,    // 2da quincena de diciembre
}

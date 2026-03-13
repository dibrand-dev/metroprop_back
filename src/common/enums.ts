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
  CASA = 1,                   // Casa
  DEPARTAMENTO = 2,           // Departamento
  TERRENO = 3,                // Terreno
  PH = 4,                     // PH
  GALPON_BODEGA = 5,          // Galpón / Bodega
  BOVEDA_NICHO_PARCELA = 6,   // Bóveda / Nicho / Parcela
  CAMA_NAUTICA = 7,           // Cama náutica
  CAMPO = 8,                  // Campo
  CONSULTORIO = 9,            // Consultorio
  DEPOSITO = 10,              // Depósito
  EDIFICIO = 11,              // Edificio
  FONDO_DE_COMERCIO = 12,     // Fondo de comercio
  GARAGE = 13,                // Garage
  HOTEL = 14,                 // Hotel
  LOCAL_COMERCIAL = 15,       // Local comercial
  OFICINA_COMERCIAL = 16,     // Oficina comercial
  QUINTA_VACACIONAL = 17,     // Quinta vacacional
}

/**
 * Subtipos de propiedad, agrupados por tipo principal.
 */
export enum PropertySubtype {
  // ── Casa ─────────────────────────────────────────────────────────────
  BUNGALOW = 1,
  CABANA = 2,         // Cabaña
  CHALET = 3,
  CONDOMINIO = 4,
  DUPLEX = 5,         // Casa / Departamento
  TRIPLEX = 6,        // Casa / Departamento
  CASA_DE_PLAYA = 7,
  PH = 8,
  PREFABRICADA = 9,

  // ── Departamento ─────────────────────────────────────────────────────
  APARTESTUDIO = 10,
  LOFT = 11,
  PENTHOUSE = 12,
  PISO = 13,
  SEMIPISO = 14,
  ESTANDAR = 15,

  // ── Bóveda / Nicho / Parcela ─────────────────────────────────────────
  BOVEDA = 16,
  NICHO = 17,
  PARCELA = 18,
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
  AMBIENTES = 1,    // Más ambientes (cocina, balcón, jardín, terraza, etc.)
  SERVICIOS = 2,    // Servicios (ascensor, encargado, internet, etc.)
  EXTRAS = 3,       // Extras (alarma, aire acondicionado, quincho, etc.)
  FACILIDADES = 4,  // Facilidades (parrilla, pileta, gimnasio, etc.)
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
 * Tipos de perfil profesional para organizaciones.
 */
export enum ProfessionalType {
  INMOBILIARIO = 'inmobiliario',
  INVERSOR = 'inversor',
  OTROS = 'otros',
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

/**
 * Plan de publicación para una propiedad.
 */
export enum PublicationPlan {
  PUBLICATION_DRAFT = 0,    // Borrador (oculto para usuarios)
  PUBLICATION_FREE = 1,     // Plan gratuito
  PUBLICATION_PREMIUM = 2,  // Plan premium
}

/**
 * Roles de usuario.
 */
export enum UserRole {
  USER_ROL_ADMIN = 1,
  USER_ROL_SELLER = 2,
  USER_ROL_COLLABORATOR = 3,
  USER_ROL_SUPER_ADMIN = 4,
}

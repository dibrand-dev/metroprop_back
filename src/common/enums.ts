/**
 * Tipos de operación para una propiedad.
 */
export enum OperationType {
  VENTA = 'Venta',
  ALQUILER = 'Alquiler',
  ALQUILER_TEMPORARIO = 'Alquiler temporario',
}

/**
 * Tipos principales de propiedad.
 */
export enum PropertyType {
  CASA = 1,
  DEPARTAMENTO = 2,
  PH = 3,
  LOCAL = 4,
  OFICINA = 5,
  TERRENO = 6,
  COCHERA = 7,
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
 * Usamos un enum para claridad y consistencia.
 */
export enum PropertyStatus {
  DRAFT = 0,      // Borrador, incompleta
  AVAILABLE = 1,  // Disponible para la venta/alquiler
  SOLD = 2,       // Vendida
  RENTED = 3,     // Alquilada
  PAUSED = 4,     // Pausada por el usuario
}

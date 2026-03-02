/**
 * Sanitiza un nombre de archivo para que sea seguro para URLs y sistemas de archivos.
 * - Reemplaza espacios y caracteres especiales con guiones.
 * - Convierte a minúsculas.
 * - Elimina caracteres no permitidos.
 * @param filename El nombre de archivo original.
 * @returns El nombre de archivo sanitizado sin extensión.
 */
export function sanitizeFilename(filename: string): string {
  // Obtener solo el nombre base sin extensión
  const parts = filename.split('.');
  const extension = parts.length > 1 ? parts.pop() : '';
  let basename = parts.join('.');
  
  // Limpiar el nombre base:
  // 1. Convertir a lowercase
  // 2. Reemplazar espacios y caracteres especiales por guiones
  // 3. Remover caracteres no alfanuméricos excepto guiones
  // 4. Remover múltiples guiones consecutivos
  // 5. Remover guiones al inicio y final
  basename = basename
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_.]/g, '') // Mantener solo letras, números, espacios, guiones y puntos
    .replace(/[\s_]+/g, '-')         // Reemplazar espacios y guiones bajos por guión
    .replace(/-+/g, '-')             // Reemplazar múltiples guiones por uno solo
    .replace(/^-+|-+$/g, '');        // Remover guiones al inicio y final
  
  // Si el nombre queda vacío después de la limpieza, usar un nombre genérico
  if (!basename) {
    basename = 'archivo';
  }
  
  return basename;
}

/**
 * Obtiene la extensión de un archivo de forma segura
 * @param filename El nombre de archivo
 * @returns La extensión en minúsculas (sin el punto) o cadena vacía si no tiene
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/**
 * Crea un nombre de archivo único agregando un identificador
 * @param sanitizedBasename Nombre base ya sanitizado
 * @param uniqueId Identificador único (ej. entity ID)
 * @param extension Extensión del archivo
 * @param maxLength Longitud máxima total del nombre (por defecto 100)
 * @returns Nombre de archivo único
 */
export function createUniqueFilename(
  sanitizedBasename: string, 
  uniqueId: number | string, 
  extension: string,
  maxLength: number = 100
): string {
  // Construir el nombre final: basename_uniqueId.extension
  const suffix = `_${uniqueId}`;
  const fullExtension = extension ? `.${extension}` : '';
  let finalName = `${sanitizedBasename}${suffix}${fullExtension}`;
  
  // Limitar la longitud total del nombre
  if (finalName.length > maxLength) {
    const maxBasenameLength = maxLength - suffix.length - fullExtension.length;
    const truncatedBasename = sanitizedBasename.substring(0, Math.max(1, maxBasenameLength));
    finalName = `${truncatedBasename}${suffix}${fullExtension}`;
  }
  
  return finalName;
}

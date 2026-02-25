/**
 * Sanitiza un nombre de archivo para que sea seguro para URLs y sistemas de archivos.
 * - Reemplaza espacios y caracteres especiales con guiones.
 * - Convierte a minúsculas.
 * - Elimina caracteres no permitidos.
 * @param filename El nombre de archivo original.
 * @returns El nombre de archivo sanitizado.
 */
export function sanitizeFilename(filename: string): string {
  const extension = filename.split('.').pop() || '';
  const name = filename.substring(0, filename.lastIndexOf('.'));

  const sanitizedName = name
    .toLowerCase()
    .replace(/\s+/g, '-') // Reemplaza espacios con -
    .replace(/[^a-z0-9-]/g, '') // Elimina caracteres no permitidos
    .replace(/-+/g, '-') // Reemplaza múltiples - con uno solo
    .replace(/^-+/, '') // Quita - del inicio
    .replace(/-+$/, ''); // Quita - del final

  return `${sanitizedName}.${extension}`;
}

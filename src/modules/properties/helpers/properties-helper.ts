import 'dotenv/config';
import { Property } from '../entities/property.entity';
import { PropertyImage } from '../entities/property-image.entity';

/**
 * Devuelve un nuevo array de PropertyImage con el prefijo insertado en el nombre del archivo.
 * Si el prefijo es vacío, retorna la url original.
 * @param prefix Prefijo a anteponer al nombre del archivo (ej: 'thumb_')
 * @param images Array de PropertyImage
 * @returns Nuevo array con urls modificadas
 */
export function prependImagePrefixToUrls(prefix: string, images: PropertyImage[]): PropertyImage[] {
  return images.map(img => {
    if (!img.url || img.url.startsWith('http')) return img;

    const lastSlash = img.url.lastIndexOf('/');
    if (lastSlash === -1) return img;
    const base = img.url.substring(0, lastSlash + 1);
    const filename = img.url.substring(lastSlash + 1);
    let newUrl = `${base}${prefix}${filename}`;
    return {
      ...img,
      url: newUrl,
    };
  });
}

/**
 * Calcula el precio por metro cuadrado de una propiedad.
 * Si recibe un id (number), busca la property en la base y calcula.
 * Si recibe un objeto, usa sus datos (surface, total_surface, roofed_surface, price).
 * Prioridad de superficie: surface > total_surface > roofed_surface
 * @param input id de property o datos de property
 * @param propertyRepo Repositorio de Property (inyectado por el service)
 * @returns number | undefined
 */
import { Repository } from 'typeorm';
export async function calculateSquareMetterPrice(
  input: number | Record<string, any>,
  propertyRepo: Repository<Property>
): Promise<number | undefined> {
  let surface: number | undefined;
  let price: number | undefined;
  let data: any = input;
  if (typeof input === 'number') {
    // Buscar property por id
    const prop = await propertyRepo.findOne({
      where: { id: input },
      select: ['surface', 'total_surface', 'roofed_surface', 'price'],
    });
    if (!prop) return undefined;
    data = prop;
  }
  // Obtener surface por prioridad
  surface =
    data.surface !== undefined && data.surface !== null
      ? data.surface
      : data.total_surface !== undefined && data.total_surface !== null
      ? data.total_surface
      : data.roofed_surface !== undefined && data.roofed_surface !== null
      ? data.roofed_surface
      : undefined;
  price = data.price !== undefined && data.price !== null ? data.price : undefined;
  if (
    typeof surface === 'number' &&
    !isNaN(surface) &&
    surface > 0 &&
    typeof price === 'number' &&
    !isNaN(price)
  ) {
    return Number(price) / Number(surface);
  }
  return undefined;
}

import { Repository } from 'typeorm';
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
    if (!img.url) return img;
    const lastSlash = img.url.lastIndexOf('/');
    if (lastSlash === -1) return img;
    const base = img.url.substring(0, lastSlash + 1);
    const filename = img.url.substring(lastSlash + 1);
    return {
      ...img,
      url: prefix ? `${base}${prefix}${filename}` : img.url,
    };
  });
}

/**
 * Calcula el precio por metro cuadrado.
 * Si se proveen surface y price, usa esos valores.
 * Si solo se provee id, busca la propiedad y usa sus valores.
 * Devuelve undefined si no se puede calcular.
 */
export async function calculateSquareMetterPrice(
  params: { id?: number; surface?: number; price?: number },
  propertyRepo: Repository<Property>
): Promise<number | undefined> {
  let surface = params.surface;
  let price = params.price;
  if ((surface === undefined || price === undefined) && params.id !== undefined) {
    // Buscar la propiedad solo por los campos necesarios
    const prop = await propertyRepo.findOne({
      where: { id: params.id },
      select: ['surface', 'price'],
    });
    if (!prop) return undefined;
    if (surface === undefined) surface = prop.surface;
    if (price === undefined) price = prop.price;
  }
  if (surface !== undefined && price !== undefined && surface > 0) {
    return Number(price) / Number(surface);
  }
  return undefined;
}

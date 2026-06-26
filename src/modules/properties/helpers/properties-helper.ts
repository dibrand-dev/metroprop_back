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
  let data: any = input;

  if (typeof input === 'number') {
    const prop = await propertyRepo.findOne({
      where: { id: input },
      select: ['roofed_surface', 'semiroofed_surface', 'unroofed_surface', 'total_surface', 'surface','price'],
    });
    if (!prop) return undefined;
    data = prop;
  }

  const priceNum = data.price !== undefined && data.price !== null ? Number(data.price) : NaN;
  if (isNaN(priceNum) || priceNum <= 0) return undefined;

  let roofedNum = data.roofed_surface !== undefined && data.roofed_surface !== null ? Number(data.roofed_surface) : NaN;
  const semiroofedNum = data.semiroofed_surface !== undefined && data.semiroofed_surface !== null ? Number(data.semiroofed_surface) : 0;

  // Fallback: if roofed is missing, derive it from total_surface - semiroofed - unroofed
  if (isNaN(roofedNum) || roofedNum <= 0) {
    const totalNum = data.total_surface !== undefined && data.total_surface !== null ? Number(data.total_surface) : NaN;
    if (!isNaN(totalNum) && totalNum > 0) {
      const unroofedNum = data.unroofed_surface !== undefined && data.unroofed_surface !== null ? Number(data.unroofed_surface) : 0;
      roofedNum = totalNum - (isNaN(semiroofedNum) ? 0 : semiroofedNum) - (isNaN(unroofedNum) ? 0 : unroofedNum);
    }
  }

  if (!isNaN(semiroofedNum) && semiroofedNum > 0) {
    roofedNum += semiroofedNum / 2;
  }

  let valuePerM = 0;
  if (!isNaN(roofedNum) && roofedNum > 0) {

    console.log("Calculating price per square meter: priceNum =", priceNum, ", roofedNum =", roofedNum);
    valuePerM = priceNum / roofedNum;
  }
  

  return valuePerM;
}

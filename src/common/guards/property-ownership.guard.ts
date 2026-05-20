import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from '../../modules/properties/entities/property.entity';
import { UserRole } from '../enums';

/**
 * Verifica que el usuario autenticado tenga permisos sobre la propiedad
 * indicada en los parámetros de ruta (`propertyId` o `id`).
 *
 * Reglas:
 * - SUPER_ADMIN (role 4): acceso irrestricto.
 * - ADMIN (role 1): solo propiedades cuya organization_id coincida con la del usuario.
 * - SELLER / COLLABORATOR (roles 2 y 3): solo propiedades cuyo user_id coincida con el usuario.
 */
@Injectable()
export class PropertyOwnershipGuard implements CanActivate {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    // SUPER_ADMIN puede hacer cualquier cosa
    if (user.role_id === UserRole.USER_ROL_SUPER_ADMIN) return true;

    const params = request.params;
    // propertyId (multimedia/upload endpoints) → unitId (unit endpoints) → id (generic)
    const rawId = params.propertyId ?? params.unitId ?? params.id;
    const propertyId = parseInt(rawId, 10);

    if (!propertyId || isNaN(propertyId)) {
      throw new NotFoundException('ID de propiedad no encontrado en la solicitud');
    }

    const property = await this.propertyRepository.findOne({
      where: { id: propertyId, deleted: false },
      select: ['id', 'user_id', 'organization_id'],
    });

    if (!property) {
      throw new NotFoundException(`Propiedad ${propertyId} no encontrada`);
    }

    this.assertOwnership(user, property);
    return true;
  }

  private assertOwnership(
    user: any,
    property: Pick<Property, 'id' | 'user_id' | 'organization_id'>,
  ): void {
    if (user.role_id === UserRole.USER_ROL_ADMIN) {
      const userOrgId = user.organization_id ?? user.organization?.id;
      if (property.organization_id !== userOrgId) {
        throw new ForbiddenException('No tenés permiso para acceder a esta propiedad');
      }
      return;
    }

    if (
      user.role_id === UserRole.USER_ROL_SELLER ||
      user.role_id === UserRole.USER_ROL_COLLABORATOR
    ) {
      if (property.user_id !== user.id) {
        throw new ForbiddenException('No tenés permiso para acceder a esta propiedad');
      }
      return;
    }

    throw new ForbiddenException('No tenés permiso para acceder a esta propiedad');
  }
}

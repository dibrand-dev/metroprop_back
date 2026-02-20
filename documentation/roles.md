# Roles

## Endpoints

### GET /roles
- Descripción: Listar todos los roles.
- Body: _No requiere body._

### GET /roles/:id
- Descripción: Obtener rol por ID.
- Body: _No requiere body._

### POST /roles
- Descripción: Crear rol.
- Body ejemplo:
```json
{
  "name": "ADMIN",
  "description": "Rol de administrador"
}
```

### PUT /roles/:id
- Descripción: Actualizar rol.
- Body ejemplo:
```json
{
  "name": "USER",
  "description": "Rol de usuario"
}
```

### DELETE /roles/:id
- Descripción: Eliminar rol.
- Body: _No requiere body._

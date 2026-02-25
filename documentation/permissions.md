# Permisos (permissions)

## Endpoints

### GET /permissions
- Descripción: Listar todos los permisos.
- Body: _No requiere body._

### GET /permissions/:id
- Descripción: Obtener permiso por ID.
- Body: _No requiere body._

### POST /permissions
- Descripción: Crear permiso.
- Body ejemplo:
```json
{
  "name": "PERMISO_NUEVO",
  "description": "Descripción del permiso"
}
```

### PUT /permissions/:id
- Descripción: Actualizar permiso.
- Body ejemplo:
```json
{
  "name": "PERMISO_EDITADO",
  "description": "Descripción editada"
}
```

### DELETE /permissions/:id
- Descripción: Eliminar permiso.
- Body: _No requiere body._

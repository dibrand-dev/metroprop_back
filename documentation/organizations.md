# Organizaciones (organizations)

## Endpoints

### GET /organizations
- Descripción: Listar todas las organizaciones.
- Body: _No requiere body._

### GET /organizations/:id
- Descripción: Obtener organización por ID.
- Body: _No requiere body._

### POST /organizations
- Descripción: Crear organización.
- Body ejemplo:
```json
{
  "name": "Mi Organización",
  "address": "Calle Principal 456"
}
```

### PATCH /organizations/:id
- Descripción: Actualizar organización.
- Body ejemplo:
```json
{
  "name": "Nombre actualizado",
  "address": "Dirección actualizada"
}
```

### DELETE /organizations/:id
- Descripción: Eliminar organización.
- Body: _No requiere body._

### POST /organizations/:id/logo
- Descripción: Subir logo (form-data, campo: logo).
- Body: _Archivo (form-data)_

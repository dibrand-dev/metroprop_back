# Sucursales (branches)

## Endpoints

### GET /branches
- Descripción: Listar todas las sucursales.
- Body: _No requiere body._

### GET /branches/:id
- Descripción: Obtener sucursal por ID.
- Body: _No requiere body._

### POST /branches
- Descripción: Crear sucursal.
- Body ejemplo:
```json
{
  "name": "Sucursal Centro",
  "address": "Calle Falsa 123"
}
```

### PUT /branches/:id
- Descripción: Actualizar sucursal.
- Body ejemplo:
```json
{
  "name": "Sucursal Actualizada",
  "address": "Nueva dirección"
}
```

### DELETE /branches/:id
- Descripción: Eliminar sucursal.
- Body: _No requiere body._

### POST /branches/:id/logo
- Descripción: Subir logo (form-data, campo: logo).
- Body: _Archivo (form-data)_

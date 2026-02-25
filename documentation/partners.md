# Partners

## Endpoints

### GET /partners
- Descripción: Listar todos los partners.
- Query params: `limit`, `offset` (opcional)
- Body: _No requiere body._

### GET /partners/:id
- Descripción: Obtener partner por ID.
- Body: _No requiere body._

### POST /partners
- Descripción: Crear partner.
- Body ejemplo:
```json
{
  "name": "Partner Ejemplo",
  "email": "partner@mail.com"
}
```

### PATCH /partners/:id
- Descripción: Actualizar partner.
- Body ejemplo:
```json
{
  "name": "Nuevo nombre",
  "email": "nuevo@mail.com"
}
```

### DELETE /partners/:id
- Descripción: Eliminar partner.
- Body: _No requiere body._

### POST /partners/:id/image
- Descripción: Subir imagen (form-data, campo: image).
- Body: _Archivo (form-data)_

---

# Partner API (api/partner/v1)

### POST /api/partner/v1/properties
- Descripción: Crear propiedad vía partner API.
- Body ejemplo:
```json
{
  "property": "datos de la propiedad"
}
```

### PUT /api/partner/v1/properties/:id
- Descripción: Actualizar propiedad vía partner API.
- Body ejemplo:
```json
{
  "property": "datos actualizados"
}
```

### DELETE /api/partner/v1/properties/:id
- Descripción: Eliminar propiedad vía partner API.
- Body ejemplo:
```json
{
  "motivo": "opcional"
}
```

### POST /api/partner/v1/properties/:id/deactivate
- Descripción: Desactivar propiedad vía partner API.
- Body ejemplo:
```json
{
  "motivo": "opcional"
}
```

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
  "description": "description",
  "app_key": "appkey12345678",
  "app_secret": "appsecret12345678",
}
```

### PATCH /partners/:id
- Descripción: Actualizar partner.
- Body ejemplo:
```json
{
  "name": "Nuevo nombre",   
}
```

### DELETE /partners/:id
- Descripción: Eliminar partner.
- Body: _No requiere body._

### POST /partners/:id/image
- Descripción: Subir imagen (form-data, campo: image).
- Body: _Archivo (form-data)_

---

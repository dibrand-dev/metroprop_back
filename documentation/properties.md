# Propiedades (properties)

## Endpoints

### POST /properties/:propertyId/upload-image
- Descripción: Subir imagen a propiedad (form-data, campo: file).
- Body: _Archivo (form-data)_

### POST /properties
- Descripción: Crear propiedad (sin relaciones).
- Body ejemplo:
```json
{
  "title": "Casa en venta",
  "address": "Calle 123",
  "price": 100000
}
``` 

### GET /properties
- Descripción: Listar propiedades.
- Query params: skip, take, property_type, status, min_price, max_price (opcional)
- Body: _No requiere body._

### GET /properties/stats
- Descripción: Estadísticas de propiedades.
- Body: _No requiere body._

### GET /properties/search
- Descripción: Buscar propiedades.
- Query params: q (texto de búsqueda)
- Body: _No requiere body._

### GET /properties/ref/:reference_code
- Descripción: Buscar propiedad por código de referencia.
- Body: _No requiere body._

### GET /properties/:id
- Descripción: Obtener propiedad por ID.
- Body: _No requiere body._

### PATCH /properties/:id
- Descripción: Actualizar propiedad.
- Body ejemplo:
```json
{
  "title": "Título actualizado",
  "price": 120000
}
```

### DELETE /properties/:id
- Descripción: Eliminar propiedad.
- Body: _No requiere body._

### PATCH /properties/:id/restore
- Descripción: Restaurar propiedad eliminada.
- Body: _No requiere body._

# Propiedades (properties)

## Endpoints


### POST /properties/:propertyId/upload-images
- Descripción: Subir múltiples imágenes a una propiedad específica usando form-data (campo: files).
- Content-Type: multipart/form-data
- Body ejemplo (usando Postman o similar):
  - Selecciona el método POST
  - URL: http://localhost:3000/properties/123/upload-images
  - En la pestaña "Body" selecciona "form-data"
  - Agrega uno o más campos con key: `files` (tipo: File) y selecciona las imágenes a subir (puedes seleccionar varias a la vez)

- Ejemplo de cURL:
```bash
curl -X POST http://localhost:3000/properties/123/upload-images \
  -H "Content-Type: multipart/form-data" \
  -F "files=@/ruta/a/imagen1.jpg" \
  -F "files=@/ruta/a/imagen2.jpg"
```

- Respuesta exitosa:
```json
[
  {
    "url": "https://s3.amazonaws.com/tu-bucket/imagen1.jpg",
    "propertyId": 123,
    "fileName": "imagen1.jpg",
    "fileSize": 123456,
    "status": null
  },
  {
    "url": "https://s3.amazonaws.com/tu-bucket/imagen2.jpg",
    "propertyId": 123,
    "fileName": "imagen2.jpg",
    "fileSize": 654321,
    "status": null
  }
]
```

- Notas:
  - El campo `files` es obligatorio y debe ser uno o más archivos de imagen.
  - Si la propiedad no existe, devuelve 404.

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

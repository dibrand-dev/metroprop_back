# Tags

## Descripción

El módulo de tags permite categorizar y etiquetar elementos del sistema. Los tags están organizados por tipos que permiten una mejor clasificación y filtrado.

## Tipos de Tags

Los tags están categorizados usando el enum `TagType`:

- **TAG_TYPE_AMENITY (1)**: Comodidades (piscina, gimnasio, etc.)
- **TAG_TYPE_SERVICES (2)**: Servicios (seguridad, portero, etc.)
- **TAG_TYPE_ROOM (3)**: Tipos de habitaciones (dormitorio en suite, etc.)

## Endpoints

### GET /tags
- **Descripción**: Obtener listado completo de tags activos.
- **Body**: _No requiere body._
- **Response**: Array de tags ordenados por nombre.

**Ejemplo de respuesta:**
```json
[
  {
    "id": 1,
    "name": "Piscina",
    "description": "Piscina climatizada",
    "type": 1,
    "is_active": true,
    "created_at": "2026-03-03T10:00:00.000Z",
    "updated_at": "2026-03-03T10:00:00.000Z"
  },
  {
    "id": 2,
    "name": "Seguridad 24hs",
    "description": "Servicio de seguridad las 24 horas",
    "type": 2,
    "is_active": true,
    "created_at": "2026-03-03T10:00:00.000Z",
    "updated_at": "2026-03-03T10:00:00.000Z"
  }
]
```

### GET /tags/type/:type
- **Descripción**: Obtener tags filtrados por tipo.
- **Parámetros**: `type` (número) - ID del tipo de tag.
- **Body**: _No requiere body._

**Ejemplos de uso:**
- `GET /tags/type/1` - Tags de amenidades
- `GET /tags/type/2` - Tags de servicios
- `GET /tags/type/3` - Tags de habitaciones

### GET /tags/types
- **Descripción**: Obtener lista de tipos de tags disponibles con conteo.
- **Body**: _No requiere body._

**Ejemplo de respuesta:**
```json
[
  {
    "type": "1",
    "count": "5"
  },
  {
    "type": "2", 
    "count": "3"
  },
  {
    "type": "3",
    "count": "2"
  }
]
```

### GET /tags/:id
- **Descripción**: Obtener un tag específico por ID.
- **Parámetros**: `id` (número) - ID del tag.
- **Body**: _No requiere body._

### POST /tags
- **Descripción**: Crear un nuevo tag.
- **Body**: Objeto CreateTagDto.

**Ejemplo de request:**
```json
{
  "name": "Gimnasio",
  "description": "Gimnasio completamente equipado",
  "type": 1,
  "is_active": true
}
```

**Validaciones:**
- `name`: String requerido (2-255 caracteres)
- `description`: String opcional (máximo 1000 caracteres)
- `type`: Enum TagType requerido (1, 2, o 3)
- `is_active`: Boolean opcional (default: true)

### PUT /tags/:id
- **Descripción**: Actualizar un tag existente.
- **Parámetros**: `id` (número) - ID del tag a actualizar.
- **Body**: Objeto UpdateTagDto (todos los campos opcionales).

**Ejemplo de request:**
```json
{
  "name": "Gimnasio Premium",
  "description": "Gimnasio con equipamiento de última generación"
}
```

### DELETE /tags/:id
- **Descripción**: Eliminar un tag.
- **Parámetros**: `id` (número) - ID del tag a eliminar.
- **Body**: _No requiere body._

**Ejemplo de respuesta:**
```json
{
  "message": "Tag deleted successfully"
}
```

## DTOs

### CreateTagDto
```typescript
{
  name: string;           // Requerido, 2-255 caracteres
  description?: string;   // Opcional, máximo 1000 caracteres
  type: TagType;         // Requerido, 1|2|3
  is_active?: boolean;   // Opcional, default: true
}
```

### UpdateTagDto
```typescript
{
  name?: string;         // Opcional, 2-255 caracteres
  description?: string;  // Opcional, máximo 1000 caracteres
  type?: TagType;       // Opcional, 1|2|3
  is_active?: boolean;  // Opcional
}
```

## Casos de uso comunes

### Obtener todas las amenidades
```bash
GET /tags/type/1
```

### Obtener todos los servicios  
```bash
GET /tags/type/2
```

### Crear un tag de amenidad
```bash
POST /tags
Content-Type: application/json

{
  "name": "Piscina Olímpica",
  "description": "Piscina de 50 metros climatizada",
  "type": 1
}
```

### Desactivar un tag
```bash
PUT /tags/5
Content-Type: application/json

{
  "is_active": false
}
```

## Notas

- Solo se retornan tags activos (`is_active: true`) en las consultas GET generales.
- Los tags están ordenados alfabéticamente por nombre.
- Al eliminar un tag se hace un soft delete (se marca como inactivo).
- El campo `type` es requerido y debe corresponder a uno de los valores del enum `TagType`.
# POST /properties/with-relations - Implementación Completa

## Descripción General
El endpoint `POST /properties/with-relations` permite crear una propiedad completa junto con sus imágenes, tags y operaciones en una única solicitud.

## Estructura de Implementación

### 1. **DTO extendido**: CreatePropertyWithRelationsDto
- Extiende `CreatePropertyDto` (hereda todos los campos de propiedad)
- Añade 3 arrays opcionales:
  - `images?: CreateImageDto[]` - Array de imágenes/planos
  - `tags?: CreateTagDto[]` - Array de tags (servicios, ambientes, adicionales)
  - `operations?: CreateOperationDto[]` - Array de operaciones

### 2. **Método en Service**: createWithRelations()
Implementado en `PropertiesService`:
```typescript
async createWithRelations(dto: CreatePropertyWithRelationsDto): Promise<Property>
```

**Flujo:**
1. Valida que no exista propiedad con el mismo `reference_code`
2. Crea la propiedad base usando `propertyRepository`
3. Itera sobre `images[]` y crea `PropertyImage` records
4. Itera sobre `tags[]` y crea `PropertyTag` records
5. Itera sobre `operations[]` y crea `PropertyOperation` records
6. Retorna la propiedad completa con todas sus relaciones cargadas

### 3. **Endpoint en Controller**
```typescript
@Post('with-relations')
@HttpCode(HttpStatus.CREATED)
createWithRelations(
  @Body() createPropertyWithRelationsDto: CreatePropertyWithRelationsDto,
)
```

**Respuesta:** 201 Created con la propiedad creada incluyendo:
- `id` (auto-generado)
- `images` array
- `tags` array
- `operations` array

## Ejemplo de Solicitud POST

**URL:** `POST /properties/with-relations`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "reference_code": "PROP-2024-001",
  "publication_title": "Casa moderna en zona residencial",
  "property_type": 2,
  "status": 1,
  "operation_type": "venta",
  "price": 250000,
  "currency": "USD",
  "street": "Av. Principal 123",
  "number": "123",
  "city": "Buenos Aires",
  "state": "Buenos Aires",
  "country": "Argentina",
  "postal_code": "1000",
  "location_id": 1,
  "branch": 1,
  "owner_name": "Juan Pérez",
  "owner_email": "juan@example.com",
  "owner_phone": "+5491123456789",
  "images": [
    {
      "url": "https://example.com/images/property-1.jpg",
      "is_blueprint": false,
      "description": "Frente de la casa",
      "order_position": 1
    },
    {
      "url": "https://example.com/images/property-2.jpg",
      "is_blueprint": true,
      "description": "Plano de la propiedad",
      "order_position": 2
    }
  ],
  "tags": [
    { "tag_id": 1, "tag_name": "Agua Corriente", "tag_type": 1 },
    { "tag_id": 34, "tag_name": "Gas Natural", "tag_type": 1 },
    { "tag_id": 152, "tag_name": "Piscina", "tag_type": 3 },
    { "tag_id": 91, "tag_name": "Lavadero", "tag_type": 2 },
    { "tag_id": 162, "tag_name": "Ascensor", "tag_type": 3 },
    { "tag_id": 93, "tag_name": "Terraza", "tag_type": 2 }
  ],
  "operations": [
    {
      "operation_type": "venta",
      "currency": "USD",
      "price": 250000,
      "period": null
    }
  ]
}
```

## Ejemplo de Respuesta

**Status:** 201 Created

**Body:**
```json
{
  "id": 1,
  "reference_code": "PROP-2024-001",
  "publication_title": "Casa moderna en zona residencial",
  "property_type": 2,
  "status": 1,
  "operation_type": "venta",
  "price": 250000,
  "currency": "USD",
  "deleted": false,
  "deleted_at": null,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z",
  "images": [
    {
      "id": 1,
      "url": "https://example.com/images/property-1.jpg",
      "is_blueprint": false,
      "description": "Frente de la casa",
      "order_position": 1,
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": 2,
      "url": "https://example.com/images/property-2.jpg",
      "is_blueprint": true,
      "description": "Plano de la propiedad",
      "order_position": 2,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "tags": [
    {
      "id": 1,
      "tag_id": 1,
      "tag_name": "Agua Corriente",
      "tag_type": 1,
      "created_at": "2024-01-15T10:30:00Z"
    },
    ...
  ],
  "operations": [
    {
      "id": 1,
      "operation_type": "venta",
      "currency": "USD",
      "price": 250000,
      "period": null,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "attributes": []
}
```

## Validaciones Aplicadas

### A Nivel de DTO (Entrada)
- `reference_code`: @MinLength(1), @MaxLength(100), obligatorio
- `publication_title`: @MinLength(1), @MaxLength(500), obligatorio
- `property_type`: número, obligatorio
- `status`: número, obligatorio
- `operation_type`: string, obligatorio
- `price`: @IsPositive, @IsNumber, obligatorio
- `currency`: @Matches(/^[A-Z]{3}$/), obligatorio (ISO 3 letras)
- Campos opcionales con restricciones (ranges de ubicación, números positivos, etc.)
- Arrays de relaciones validados recursivamente

### A Nivel de Entidad (BD)
- `reference_code`: UNIQUE constraint (no permite duplicados)
- Relaciones con cascade delete (eliminar propiedad elimina imágenes, tags, operaciones)
- Foreign keys aseguran referencial integrity

### A Nivel de Service
- Verificación de `reference_code` existente antes de crear
- Validación de que los arrays no sean null/undefined

## Manejo de Errores

| Escenario | Status | Respuesta |
|-----------|--------|-----------|
| reference_code duplicado | 400 Bad Request | "Una propiedad con este código de referencia ya existe" |
| Campo obligatorio faltante | 400 Bad Request | Detalles de validación |
| currency formato inválido | 400 Bad Request | "currency must match ^[A-Z]{3}$" |
| price negativo | 400 Bad Request | "price must be a positive number" |
| Éxito | 201 Created | Objeto Property con todas las relaciones |

## Características

✅ **Atomicidad**: Se crea la propiedad y todas sus relaciones en secuencia
✅ **Validación Completa**: Todos los campos validados por class-validator
✅ **Relaciones Automáticas**: Los IDs de imágenes, tags y operaciones se auto-generan
✅ **Búsqueda de Relaciones**: Retorna la propiedad con todas sus relaciones cargadas
✅ **Soft Delete Compatible**: Propiedad creada con `deleted: false`
✅ **Timestamps Automáticos**: `created_at` y `updated_at` se generan automáticamente

## Archivos Modificados

1. **properties.service.ts**
   - Inyectados 3 nuevos repositorios: PropertyImage, PropertyTag, PropertyOperation
   - Implementado método `createWithRelations()`

2. **properties.controller.ts**
   - Agregado endpoint `POST /properties/with-relations` con handler

3. **create-property-with-relations.dto.ts** (ya existente)
   - Define estructura de entrada con arrays de relaciones

4. **properties.module.ts** (ya tiene todos los repositorios registrados)
   - Todos los repositorios ya estaban configurados

## Cómo Probar

### Con curl:
```bash
curl -X POST http://localhost:3000/properties/with-relations \
  -H "Content-Type: application/json" \
  -d @examples/create-property-with-relations.json
```

### Con Postman:
1. Crear nueva request POST
2. URL: `http://localhost:3000/properties/with-relations`
3. Headers: `Content-Type: application/json`
4. Body: JSON raw (copiar del archivo de ejemplo)
5. Send

### Con Thunder Client (VS Code):
1. Abrir la extensión Thunder Client
2. Crear nuevo request POST
3. Pegar la URL y el JSON de ejemplo
4. Send

## Notas Importantes

- Los arrays de relaciones (`images`, `tags`, `operations`) son **opcionales**
- Si no se envían arrays vacíos, simplemente no se crean esas relaciones
- La propiedad se crea de todos modos incluso si los arrays están vacíos
- Todos los campos dentro de los arrays son obligatorios si el array está presente
- Los IDs de las relaciones se auto-generan (no necesita proporcionar)
- Las relaciones se cargan completamente antes de retornar (puede ser lento con muchas relaciones)

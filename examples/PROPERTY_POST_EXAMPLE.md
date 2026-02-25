# Ejemplo: POST Property con Todas las Relaciones

Este archivo contiene un ejemplo completo de un request POST para crear una propiedad que utiliza **todas las relaciones disponibles**.

## Estructura del Payload

### Campos Obligatorios (Base Property)
- **reference_code**: Código único de referencia (ej: `PROP-APT-2024-001`)
- **publication_title**: Título de publicación en español
- **property_type**: ID del tipo de propiedad (número)
- **status**: Estado de la propiedad (número)

### Relaciones Incluidas

#### 1. **Images** (2 imágenes)
```json
"images": [
  {
    "url": "string",           // Obligatorio: URL de la imagen
    "is_blueprint": boolean,   // Opcional: Indica si es plano
    "description": "string",   // Opcional: Descripción de la imagen
    "order_position": number   // Opcional: Orden de visualización
  }
]
```

#### 2. **Tags** (3 tags de ejemplo)
```json
"tags": [
  {
    "tag_id": number,          // Obligatorio: ID del tag
    "tag_name": "string",      // Obligatorio: Nombre del tag
    "tag_type": number         // Obligatorio: Tipo 1=servicios, 2=ambientes, 3=adicionales
  }
]
```

#### 3. **Operations** (múltiples operaciones)
```json
"operations": [
  {
    "operation_type": "string", // Obligatorio: "venta" o "alquiler"
    "currency": "string",       // Obligatorio: Código ISO (ARS, USD, etc)
    "price": number,            // Obligatorio: Precio positivo
    "period": "string"          // Opcional: "mensual", "anual", etc
  }
]
```

### Campos Opcionales Adicionales

- **publication_title_en**: Título en inglés
- **description**: Descripción detallada
- **internal_comments**: Comentarios internos
- **street, number, floor, apartment**: Ubicación
- **location_id**: ID de localidad
- **geo_lat, geo_long**: Coordenadas geográficas
- **suite_amount**: Cantidad de suites
- **room_amount**: Cantidad de habitaciones
- **bathroom_amount**: Cantidad de baños
- **toilet_amount**: Cantidad de sanitarios
- **parking_lot_amount**: Cantidad de cocheras
- **surface**: Superficie total en m²
- **roofed_surface**: Superficie techada
- **unroofed_surface**: Superficie descubierta
- **semiroofed_surface**: Superficie semi-techada

## Endpoint

```
POST /properties
Content-Type: application/json
```

## Respuesta Esperada

La API retornará la propiedad creada con:
- ID asignado
- Timestamps (createdAt, updatedAt)
- Todas las relaciones pobladas (images, tags, operations)

## Validaciones Importantes

1. **reference_code** debe ser único en la BD
2. **currency** debe ser código ISO de 3 letras (ARS, USD, EUR, etc)
3. **tag_type** debe estar entre 1 y 3
4. **price** debe ser un número positivo
5. **geo_lat** debe estar entre -90 y 90
6. **geo_long** debe estar entre -180 y 180
7. Todas las imágenes deben tener URLs válidas
8. Se pueden incluir de 1 a N operaciones


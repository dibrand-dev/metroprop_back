# Tokko Helper - Mapeo de Propiedades

Helper para mapear propiedades de nuestra estructura de base de datos al formato Tokko Property.

## Características implementadas

### ✅ Mapeo principal
- **Recibe**: `reference_code` de una propiedad
- **Busca**: La propiedad usando `PropertiesService.findByReferenceCode()`
- **Retorna**: Propiedad en formato JSON compatible con TokkoProperty

### ⭐ ✅ Mapeo inverso (**NUEVO**)
- **Recibe**: JSON en formato Tokko (TokkoPropertyResponse)
- **Mapea**: Todos los campos a formato Metroprop
- **Retorna**: Propiedad en formato compatible con CreatePropertyDto
- **Función**: `mapToMetropropFormat(tokkoData)`

### ✅ Mapeos específicos implementados
1. `address` → `street`
2. `apartment_door` → `apartment`
3. `appartments_per_floor` → `apartments_per_floor`
4. `covered_parking_lot` → `garage_coverage = 1` (garage cubierto)
5. `uncovered_parking_lot` → `garage_coverage = 2` (garage descubierto)
6. `depth_measure` → `surface_length`
7. `front_measure` → `surface_front`
8. `disposition` → `dispositions`
9. `guests_amount` → `number_of_guests`
10. `photos` → `images` (mapeado con order y metadata)
11. `files` → `attached`
12. `type` → `property_type` (con códigos Tokko)
13. `operations[]` → campos planos `operation_type`, `price`, `currency`, `period`

### ⭐ ✅ Mapeos inversos implementados (Tokko → Metroprop) (**NUEVO**)
1. `address`/`real_address` → `street`
2. `apartment_door` → `apartment`
3. `appartments_per_floor` → `apartments_per_floor`
4. `covered_parking_lot`/`uncovered_parking_lot` → `garage_coverage`
5. `depth_measure` → `surface_length`
6. `front_measure` → `surface_front`
7. `disposition` → `dispositions`
8. `guests_amount` → `number_of_guests`
9. `photos` → `images` (con url, order, description)
10. `files` → `attached`
11. `type.code` → `property_type` (enum mapping)
12. `operations[0]` → `operation_type`, `price`, `currency`, `period`
13. `custom_tags` → `has_sign` (detecta "Cartel")
14. `internal_data.*` → campos internos (`internal_comments`, `commission`, etc.)
15. `producer.*` → `producer_user`, `user_id`
16. `location.*` → `location_id`, `postal_code`

### ✅ Custom Tags
- **has_sign**: Se mapea desde el campo `has_sign` de la property entity
- **custom_tags**: Si `has_sign=true`, se genera automáticamente el tag "Cartel" 
- **Descripción**: Los custom tags se agregarán a la descripción bajo "Otros datos:" (pendiente implementar custom tags completos)

### ✅ Tags de ambientes
Estos se procesan desde los tags existentes de la propiedad:
- `dining_room` → detecta tags con "comedor"
- `living_amount` → detecta tags con "living"
- `suites_with_closets` → cuenta tags con "vestidor" o "closet" 
- `tv_rooms` → cuenta tags con "tv" o "televisión"

### ✅ Campos sin mapeo (39 campos)
La función `getUnmappedFields()` lista todos los campos que requieren:
- Campos nuevos en DB (address_complement, block_number, building, etc.)
- Integraciones adicionales (gm_location_type, public_url)
- Lógica de negocio específica (occupation, quality_level)

## Uso

### Endpoints disponibles:

#### 1. Propiedad → Formato Tokko
```http
GET /properties/tokko-format/{reference_code}
```

**Ejemplo de uso:**
```bash
curl http://localhost:3000/properties/tokko-format/MHO7861865
```

#### 2. Formato Tokko → Formato Metroprop ⭐ **NUEVO**
```http
POST /properties/from-tokko
```

**Ejemplo de uso:**
```bash
curl -X POST http://localhost:3000/properties/from-tokko \
  -H "Content-Type: application/json" \
  -d @tokko_property_sample.json
```

### Respuesta del mapeo Tokko → Metroprop:
```json
{
  "reference_code": "MHO7861865",
  "publication_title": "Casa en Palermo",
  "property_type": 1,
  "status": 2,
  "operation_type": 1,
  "price": 120000,
  "currency": "USD",
  "street": "helguera al 11100",
  "apartment": "",
  "has_sign": true,
  "garage_coverage": 1,
  "surface": 12.00,
  "images": [
    {
      "url": "https://static.tokkobroker.com/pictures/...",
      "is_blueprint": false,
      "order_position": 0
    }
  ],
  "videos": [],
  "attached": [],
  "tags": []
}
```

### Respuesta del mapeo Metroprop → Tokko:
```json
{
  "id": 7861865,
  "address": "helguera al 11100",
  "age": 0,
  "bathroom_amount": 1,
  "has_sign": true,
  "custom_tags": [
    {
      "group_name": "Cartel",
      "id": 76255,
      "name": "Tiene cartel",
      "public_name": ""
    }
  ],
  "operations": [
    {
      "operation_id": 1,
      "operation_type": "Venta",
      "prices": [
        {
          "currency": "USD",
          "is_promotional": false,
          "period": 0,
          "price": 120000
        }
      ]
    }
  ],
  "type": {
    "code": "HO",
    "id": 3,
    "name": "Casa"
  },
  // ... resto de campos mapeados
}
```

## Campo has_sign agregado

Se agregó el campo `has_sign` a:
- ✅ `Property` entity: `@Column({ type: 'boolean', nullable: true, default: false })`
- ✅ `BasePropertyFieldsDto`: Con validación `@IsBoolean()`

## Funciones principales

### 🔄 `mapToTokkoFormat(referenceCode: string)`
Convierte propiedad de DB → formato Tokko

### ⭐ 🔄 `mapToMetropropFormat(tokkoData: TokkoPropertyResponse)` (**NUEVO**)
Convierte propiedad formato Tokko → formato Metroprop

**Características del mapeo inverso:**
- ✅ **Detección automática has_sign**: Busca custom tags "Cartel"
- ✅ **Mapeo de enums**: PropertyType, PropertyStatus, OperationType, etc.  
- ✅ **Extracción de operaciones**: Precio, currency y period desde array de operations
- ✅ **Mapeo de multimedia**: photos→images, files→attached, videos
- ✅ **Parsing numérico**: Convierte strings a numbers cuando corresponde
- ✅ **Internal data**: Comisión, comentarios internos, maintenance_user, etc.
- ✅ **Valores por defecto**: Para campos opcionales sin equivalencia

## Trabajo futuro

1. **Custom Tags completos**: Crear relación para custom tags reales
2. **Campos adicionales**: Implementar los 39 campos listados en `getUnmappedFields()`
3. **Integración Google Maps**: Para `gm_location_type`
4. **Generación URLs**: Para `public_url`
5. **Location mapping**: Integrar con tabla de locations para mapeo completo
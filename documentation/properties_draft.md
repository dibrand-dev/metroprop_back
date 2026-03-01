# Crear borrador de propiedad (draft)

### POST /properties/draft
- Descripción: Crear un borrador de propiedad. Rellena los campos obligatorios con valores por defecto.
- Body ejemplo:
```json
{
  "operation_type": "Venta",
  "property_type": "1",
  "property_subtype": "8" // Opcional
}
```

- Respuesta exitosa:
```json
{
  "id": 123,
  "operation_type": "Venta",
  "property_type": "1",
  "property_subtype": "DETACHED",
  "status": "DRAFT",
  "reference_code": "DRAFT-1a2b3c4d",
  "publication_title": "Borrador - DRAFT-1a2b3c4d",
  "price": 0,
  "currency": "USD",
  // ...otros campos por defecto
}
```

- Notas:
  - `operation_type` y `property_type` son obligatorios.
  - `property_subtype` es opcional.
  - El resto de los campos se completan automáticamente con valores por defecto.

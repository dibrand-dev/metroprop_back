# Partner API - cURL Examples

## Crear Propiedad
```bash
curl -X POST http://localhost:3000/api/partner/v1/properties \
  -H "Content-Type: application/json" \
  -H "x-api-key: tech_integrations_prod_key_2024" \
  -H "x-api-secret: tech_secret_2024_secure_hash" \
  -d '{
    "title": "Departamento en Palermo",
    "description": "Hermoso departamento de 2 ambientes",
    "price": 180000,
    "currency": "USD",
    "operation_type": "sale",
    "property_type": 1,
    "rooms": 2,
    "bathrooms": 1,
    "surface": 65
  }'
```

## Actualizar Propiedad
```bash
curl -X PUT http://localhost:3000/api/partner/v1/properties/123 \
  -H "Content-Type: application/json" \
  -H "x-api-key: tech_integrations_prod_key_2024" \
  -H "x-api-secret: tech_secret_2024_secure_hash" \
  -d '{
    "price": 185000,
    "description": "Hermoso departamento de 2 ambientes - PRECIO ACTUALIZADO"
  }'
```

## Eliminar Propiedad
```bash
curl -X DELETE http://localhost:3000/api/partner/v1/properties/123 \
  -H "Content-Type: application/json" \
  -H "x-api-key: tech_integrations_prod_key_2024" \
  -H "x-api-secret: tech_secret_2024_secure_hash" \
  -d '{
    "reason": "Propiedad vendida"
  }'
```

## Desactivar Propiedad
```bash
curl -X POST http://localhost:3000/api/partner/v1/properties/123/deactivate \
  -H "Content-Type: application/json" \
  -H "x-api-key: tech_integrations_prod_key_2024" \
  -H "x-api-secret: tech_secret_2024_secure_hash" \
  -d '{
    "reason": "Temporalmente no disponible",
    "reactivate_date": "2026-03-01"
  }'
```

## Con API Key en Query Parameter
```bash
curl -X POST "http://localhost:3000/api/partner/v1/properties?api_key=tech_integrations_prod_key_2024&api_secret=tech_secret_2024_secure_hash" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Casa en San Isidro",
    "price": 250000,
    "currency": "USD"
  }'
```
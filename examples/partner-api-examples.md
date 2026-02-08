# Partner API Examples

Ejemplos de uso de la API RESTful para partners con credenciales:
- API Key: `tech_integrations_prod_key_2024`
- API Secret: `tech_secret_2024_secure_hash`

## Autenticación

Se requieren **AMBAS** credenciales para autenticarse. Pueden enviarse de tres formas:

### Headers (Recomendado):
```
x-api-key: tech_integrations_prod_key_2024
x-api-secret: tech_secret_2024_secure_hash
```

### Headers alternativos:
```
api-key: tech_integrations_prod_key_2024
api-secret: tech_secret_2024_secure_hash
```

### Query parameters:
```
?api_key=tech_integrations_prod_key_2024&api_secret=tech_secret_2024_secure_hash
```

## Base URL
```
http://localhost:3000/api/partner/v1
```

---

## 1. Crear Propiedad

### Request:
```http
POST /api/partner/v1/properties
Content-Type: application/json
x-api-key: tech_integrations_prod_key_2024
x-api-secret: tech_secret_2024_secure_hash

{
  "title": "Departamento en Palermo",
  "description": "Hermoso departamento de 2 ambientes",
  "price": 180000,
  "currency": "USD",
  "operation_type": "sale",
  "property_type": 1,
  "rooms": 2,
  "bathrooms": 1,
  "surface": 65,
  "address": {
    "street": "Av. Santa Fe",
    "number": "3456",
    "neighborhood": "Palermo",
    "city": "Buenos Aires"
  }
}
```

### Response:
```json
{
  "action": "CREATE_PROPERTY",
  "partner_id": 1,
  "partner_name": "Tech Integrations",
  "body": {
    "title": "Departamento en Palermo",
    "description": "Hermoso departamento de 2 ambientes",
    "price": 180000,
    "currency": "USD",
    "operation_type": "sale",
    "property_type": 1,
    "rooms": 2,
    "bathrooms": 1,
    "surface": 65,
    "address": {
      "street": "Av. Santa Fe",
      "number": "3456",
      "neighborhood": "Palermo",
      "city": "Buenos Aires"
    }
  },
  "timestamp": "2026-02-08T01:23:45.678Z"
}
```

---

## 2. Actualizar Propiedad

### Request:
```http
PUT /api/partner/v1/properties/123
Content-Type: application/json
x-api-key: tech_integrations_prod_key_2024
x-api-secret: tech_secret_2024_secure_hash

{
  "price": 185000,
  "description": "Hermoso departamento de 2 ambientes - PRECIO ACTUALIZADO"
}
```

### Response:
```json
{
  "action": "UPDATE_PROPERTY",
  "property_id": "123",
  "partner_id": 1,
  "partner_name": "Tech Integrations",
  "body": {
    "price": 185000,
    "description": "Hermoso departamento de 2 ambientes - PRECIO ACTUALIZADO"
  },
  "timestamp": "2026-02-08T01:25:30.123Z"
}
```

---

## 3. Eliminar Propiedad

### Request:
```http
DELETE /api/partner/v1/properties/123
Content-Type: application/json
x-api-key: tech_integrations_prod_key_2024
x-api-secret: tech_secret_2024_secure_hash

{
  "reason": "Propiedad vendida"
}
```

### Response:
```json
{
  "action": "DELETE_PROPERTY",
  "property_id": "123",
  "partner_id": 1,
  "partner_name": "Tech Integrations",
  "body": {
    "reason": "Propiedad vendida"
  },
  "timestamp": "2026-02-08T01:30:15.456Z"
}
```

---

## 4. Desactivar Propiedad

### Request:
```http
POST /api/partner/v1/properties/123/deactivate
Content-Type: application/json
x-api-key: tech_integrations_prod_key_2024
x-api-secret: tech_secret_2024_secure_hash

{
  "reason": "Temporalmente no disponible",
  "reactivate_date": "2026-03-01"
}
```

### Response:
```json
{
  "action": "DEACTIVATE_PROPERTY",
  "property_id": "123",
  "partner_id": 1,
  "partner_name": "Tech Integrations",
  "body": {
    "reason": "Temporalmente no disponible",
    "reactivate_date": "2026-03-01"
  },
  "timestamp": "2026-02-08T01:35:42.789Z"
}
```

---

## Errores de Autenticación

### Sin API Key:
```json
{
  "statusCode": 401,
  "message": "API Key is required",
  "error": "Unauthorized"
}
```

### Sin API Secret:
```json
{
  "statusCode": 401,
  "message": "API Secret is required",
  "error": "Unauthorized"
}
```

### API Key o Secret Inválidos:
```json
{
  "statusCode": 401,
  "message": "Invalid API Key or Secret",
  "error": "Unauthorized"
}
```
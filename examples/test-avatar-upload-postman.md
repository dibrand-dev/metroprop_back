# Test Image Upload - Postman Instructions

## Users, Organizations y Properties

### Prerequisites
1. Asegúrate de tener configuradas las variables de entorno de AWS S3:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_S3_BUCKET_NAME`
   - `AWS_REGION`

2. El servidor debe estar corriendo en: `http://localhost:3000`

---

## Test USERS Avatar Upload

### 1. **Crear/Verificar que existe un usuario**

```http
POST http://localhost:3000/users
Content-Type: application/json

{
  "name": "Test User",
  "email": "testuser@example.com",
  "password": "password123"
}
```

### 2. **Upload Avatar**

#### Configuración en Postman:
1. **Method:** `POST`
2. **URL:** `http://localhost:3000/users/1/avatar` (reemplaza `1` con el ID del usuario)
3. **Body:** form-data
4. **Key:** `avatar` (tipo File)
5. **Value:** Selecciona tu imagen

#### Response esperada:
```json
{
  "message": "Avatar uploaded successfully",
  "imageUrl": "https://tu-bucket.s3.amazonaws.com/users/1/1709123456789.jpg",
  "userId": 1,
  "key": "1/1709123456789.jpg",
  "fileSize": 102400,
  "fileName": "mi-foto.jpg"
}
```

---

## Test ORGANIZATIONS Logo Upload

### 1. **Crear/Verificar que existe una organización**

```http
POST http://localhost:3000/organizations
Content-Type: application/json

{
  "company_name": "Mi Empresa SRL",
  "email": "empresa@example.com",
  "phone": "1122334455"
}
```

### 2. **Upload Logo**

#### Configuración en Postman:
1. **Method:** `POST`
2. **URL:** `http://localhost:3000/organizations/1/logo` (reemplaza `1` con el ID de la organización)
3. **Body:** form-data
4. **Key:** `logo` (tipo File)
5. **Value:** Selecciona tu imagen

#### Response esperada:
```json
{
  "message": "Logo uploaded successfully",
  "imageUrl": "https://tu-bucket.s3.amazonaws.com/organizations/1/1709123456789.jpg",
  "organizationId": 1,
  "key": "1/1709123456789.jpg",
  "fileSize": 102400,
  "fileName": "mi-logo.jpg"
}
```

---

## Test PROPERTIES Image Upload

### 1. **Crear/Verificar que existe una propiedad**

```http
POST http://localhost:3000/properties
Content-Type: application/json

{
  "reference_code": "PROP001",
  "publication_title": "Casa en Palermo",
  "property_type": 1,
  "status": 1,
  "operation_type": "sale",
  "price": 180000,
  "currency": "USD"
}
```

### 2. **Upload Image**

#### Configuración en Postman:
1. **Method:** `POST`
2. **URL:** `http://localhost:3000/properties/1/upload-image` (reemplaza `1` con el ID de la propiedad)
3. **Body:** form-data
4. **Key:** `file` (tipo File)
5. **Value:** Selecciona tu imagen

#### Response esperada:
```json
{
  "url": "https://tu-bucket.s3.amazonaws.com/properties/1/1709123456789.jpg",
  "key": "1/1709123456789.jpg",
  "propertyId": 1,
  "fileName": "mi-propiedad.jpg",
  "fileSize": 102400
}
```

---

## Patrones de Nomenclatura

Todas las imágenes se suben con el patrón:
- **Key:** `{entityId}/{timestamp}.{extension}`
- **Path completo:** `{folder}/{entityId}/{timestamp}.{extension}`

### Ejemplos:
- **Users:** `users/1/1709123456789.jpg`
- **Organizations:** `organizations/1/1709123456789.jpg` 
- **Properties:** `properties/1/1709123456789.jpg`

---

## Verificar Uploads

### Verificar User:
```http
GET http://localhost:3000/users/1
```

### Verificar Organization:
```http
GET http://localhost:3000/organizations/1
```

### Verificar Property:
```http
GET http://localhost:3000/properties/1
```
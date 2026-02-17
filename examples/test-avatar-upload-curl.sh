# Test Image Upload - cURL Examples

## USERS Avatar Upload

### Crear usuario:
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "testuser@example.com", 
    "password": "password123"
  }'
```

### Upload avatar:
```bash
# Windows
curl -X POST http://localhost:3000/users/1/avatar \
  -F "avatar=@C:\Users\YourName\Pictures\profile.jpg"

# Linux/Mac
curl -X POST http://localhost:3000/users/1/avatar \
  -F "avatar=@/home/username/pictures/profile.jpg"
```

### Verificar usuario actualizado:
```bash
curl http://localhost:3000/users/1
```

---

## ORGANIZATIONS Logo Upload

### Crear organización:
```bash
curl -X POST http://localhost:3000/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Mi Empresa SRL",
    "email": "empresa@example.com",
    "phone": "1122334455"
  }'
```

### Upload logo:
```bash
# Windows
curl -X POST http://localhost:3000/organizations/1/logo \
  -F "logo=@C:\Users\YourName\Pictures\company-logo.jpg"

# Linux/Mac
curl -X POST http://localhost:3000/organizations/1/logo \
  -F "logo=@/home/username/pictures/company-logo.jpg"
```

### Verificar organización actualizada:
```bash
curl http://localhost:3000/organizations/1
```

---

## PROPERTIES Image Upload

### Crear propiedad:
```bash
curl -X POST http://localhost:3000/properties \
  -H "Content-Type: application/json" \
  -d '{
    "reference_code": "PROP001",
    "publication_title": "Casa en Palermo",
    "property_type": 1,
    "status": 1,
    "operation_type": "sale",
    "price": 180000,
    "currency": "USD"
  }'
```

### Upload imagen:
```bash
# Windows
curl -X POST http://localhost:3000/properties/1/upload-image \
  -F "file=@C:\Users\YourName\Pictures\house.jpg"

# Linux/Mac
curl -X POST http://localhost:3000/properties/1/upload-image \
  -F "file=@/home/username/pictures/house.jpg"
```

### Verificar propiedad:
```bash
curl http://localhost:3000/properties/1
```

---

## Responses de ejemplo:

### User Upload Response:
```json
{
  "message": "Avatar uploaded successfully",
  "imageUrl": "https://bucket.s3.region.amazonaws.com/users/1/1709123456789.jpg",
  "userId": 1,
  "key": "1/1709123456789.jpg",
  "fileSize": 102400,
  "fileName": "profile.jpg"
}
```

### Organization Upload Response:
```json
{
  "message": "Logo uploaded successfully",
  "imageUrl": "https://bucket.s3.region.amazonaws.com/organizations/1/1709123456789.jpg",
  "organizationId": 1,
  "key": "1/1709123456789.jpg",
  "fileSize": 102400,
  "fileName": "company-logo.jpg"
}
```

### Property Upload Response:
```json
{
  "url": "https://bucket.s3.region.amazonaws.com/properties/1/1709123456789.jpg",
  "key": "1/1709123456789.jpg",
  "propertyId": 1,
  "fileName": "house.jpg",
  "fileSize": 102400
}
```
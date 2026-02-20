## Configuración AWS S3 para imágenes

Agrega las siguientes variables de entorno en tu archivo `.env`:

```
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=nombre-del-bucket
```

Estas variables son necesarias para subir imágenes a AWS S3 desde el endpoint `/properties/upload-image`.
# MetroProp Backend - NestJS PostgreSQL API

Production-ready backend for Tokko CRM. Create properties with images, tags, and operations in a single request.

---

## ⚡ Quick Start (30 Seconds)

### 1. Start server
```bash
npm start
```

### 2. PowerShell command
```powershell
$body = @{
    reference_code = "TEST-001"
    publication_title = "Casa"
    property_type = 2
    status = 1
    operation_type = "venta"
    price = 100000
    currency = "USD"
    location_id = 1
    branch = 1
    images = @(
        @{ url = "https://example.com/img1.jpg"; is_blueprint = $false; order_position = 1 },
        @{ url = "https://example.com/img2.jpg"; is_blueprint = $true; order_position = 2 }
    )
    tags = @(
        @{ tag_id = 1; tag_name = "Agua"; tag_type = 1 },
        @{ tag_id = 34; tag_name = "Gas"; tag_type = 1 },
        @{ tag_id = 152; tag_name = "Piscina"; tag_type = 3 },
        @{ tag_id = 91; tag_name = "Lavadero"; tag_type = 2 },
        @{ tag_id = 162; tag_name = "Ascensor"; tag_type = 3 },
        @{ tag_id = 93; tag_name = "Terraza"; tag_type = 2 }
    )
    operations = @(
        @{ operation_type = "venta"; currency = "USD"; price = 100000 }
    )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:3000/properties/with-relations" `
    -Method POST -ContentType "application/json" -Body $body | ConvertTo-Json
```

✅ **Result: Property created with 2 images, 6 tags, 1 operation**

---

## 📖 Contents

- [Features](#features)
- [API Endpoints](#api-endpoints)
- [Installation](#installation)
- [Required Fields](#required-fields)
- [Testing](#testing)
- [Validation](#validation)
- [Errors](#errors)
- [Examples](#examples)
- [Architecture](#architecture)

---

## ✨ Features

✅ Create property + images + tags + operations in ONE request  
✅ NestJS 10.3 + TypeORM + PostgreSQL 16  
✅ Full validation (DTO, Service, Database)  
✅ Soft delete + Cascade delete  
✅ 9 REST endpoints  
✅ JWT Authentication  

---

## 🔌 API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| **POST** | **/properties/with-relations** | ⭐ Create with images + tags + operations |
| POST | /properties | Create simple property |
| GET | /properties | List (filters, pagination) |
| GET | /properties/:id | Get by ID with relations |
| GET | /properties/ref/:code | Get by reference_code |
| PATCH | /properties/:id | Update property |
| DELETE | /properties/:id | Soft delete |
| PATCH | /properties/:id/restore | Restore deleted |
| GET | /properties/stats | Statistics |
| GET | /properties/search?q=text | Text search |

---

## 📦 Installation

### Prerequisites
- Node.js 20+
- PostgreSQL 16+

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Create .env
cp .env.example .env
# Edit DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, etc.

# 3. Docker (optional)
docker-compose up -d

# 4. Run migrations
npm run typeorm migration:run

# 5. Start
npm run start:dev
```

### Environment Variables
```env
NODE_ENV=development
PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=metroprop_db
JWT_SECRET=your_secret_key
```

---

## 📋 Required Fields

All requests need these 7 mandatory fields:

```json
{
  "reference_code": "PROP-001",        // Unique identifier
  "publication_title": "Casa",         // Property title
  "property_type": 2,                  // Type code
  "status": 1,                         // Status code
  "operation_type": "venta",           // venta | alquiler
  "price": 100000,                     // Must be > 0
  "currency": "USD"                    // ISO code (USD, ARS, EUR)
}
```

### Optional Fields (Common)
```json
{
  "location_id": 1,
  "branch": 1,
  "street": "Av. Principal 123",
  "number": "123",
  "city": "Buenos Aires",
  "country": "Argentina",
  "geo_lat": -34.6037,                 // -90 to 90
  "geo_long": -58.3816,                // -180 to 180
  "owner_name": "Juan",
  "owner_email": "juan@example.com",
  "owner_phone": "+5491123456789",
  "total_surface": 250,
  "room_amount": 3,
  "bathroom_amount": 2,
  "garage_spots": 2,
  "description": "Beautiful house"
}
```

### Images, Tags, Operations (Optional Arrays)
```json
{
  "images": [
    { "url": "https://...", "is_blueprint": false, "order_position": 1 },
    { "url": "https://...", "is_blueprint": true, "order_position": 2 }
  ],
  "tags": [
    { "tag_id": 1, "tag_name": "Agua", "tag_type": 1 },
    { "tag_id": 34, "tag_name": "Gas", "tag_type": 1 },
    { "tag_id": 152, "tag_name": "Piscina", "tag_type": 3 },
    { "tag_id": 91, "tag_name": "Lavadero", "tag_type": 2 },
    { "tag_id": 162, "tag_name": "Ascensor", "tag_type": 3 },
    { "tag_id": 93, "tag_name": "Terraza", "tag_type": 2 }
  ],
  "operations": [
    { "operation_type": "venta", "currency": "USD", "price": 250000, "period": null }
  ]
}
```

---

## 🧪 Testing

### Option 1: PowerShell (Windows)
See Quick Start above - copy/paste ready!

### Option 2: cURL
```bash
curl -X POST http://localhost:3000/properties/with-relations \
  -H "Content-Type: application/json" \
  -d @examples/create-property-with-relations.json
```

### Option 3: Postman
1. POST `http://localhost:3000/properties/with-relations`
2. Headers: `Content-Type: application/json`
3. Body (raw): Paste from `examples/create-property-with-relations.json`
4. Send

### Option 4: Thunder Client (VS Code)
1. Install extension "Thunder Client"
2. New Request → POST
3. URL: `http://localhost:3000/properties/with-relations`
4. Body: Paste JSON
5. Send

### Option 5: JavaScript/Fetch
```javascript
fetch('http://localhost:3000/properties/with-relations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(propertyData)
})
.then(r => r.json())
.then(data => console.log('Created:', data));
```

### Option 6: Axios (Node.js)
```javascript
axios.post('http://localhost:3000/properties/with-relations', propertyData)
  .then(res => console.log('Created:', res.data))
  .catch(err => console.error('Error:', err.response.data));
```

---

## ✅ Validation

### Validations Applied

| Field | Rules |
|-------|-------|
| reference_code | Unique, Length: 1-100 |
| publication_title | Length: 1-500 |
| property_type | Number, Required |
| status | Number, Required |
| operation_type | String, Required |
| price | Positive, Required |
| currency | Matches: ^[A-Z]{3}$ |
| geo_lat | Range: -90 to 90 |
| geo_long | Range: -180 to 180 |

### 3-Level Validation

1. **DTO Level** - class-validator decorators (format, length, type)
2. **Service Level** - Business logic (reference_code uniqueness)
3. **Database Level** - Constraints (UNIQUE, NOT NULL, FK)

---

## ❌ Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 400: "Una propiedad con este código..." | Duplicate reference_code | Use unique code |
| 400: "price must be positive" | price ≤ 0 | Use price > 0 |
| 400: "currency must match ^[A-Z]{3}$" | Invalid format | Use USD, ARS, EUR |
| 400: "publication_title should not be empty" | Missing title | Provide title |
| 500: Internal Server Error | DB or server issue | Check logs |
| 404: Not Found | Resource doesn't exist | Verify ID/code |

### Response Format

**201 Created** (Success)
```json
{
  "id": 1,
  "reference_code": "PROP-001",
  "images": [{"id": 1}, {"id": 2}],
  "tags": [{"id": 1}, ..., {"id": 6}],
  "operations": [{"id": 1}]
}
```

**400 Bad Request** (Validation Error)
```json
{
  "statusCode": 400,
  "message": ["price must be a positive number"],
  "error": "Bad Request"
}
```

---

## 📝 Examples

### Minimal Property
```json
{
  "reference_code": "PROP-001",
  "publication_title": "Casa",
  "property_type": 2,
  "status": 1,
  "operation_type": "venta",
  "price": 100000,
  "currency": "USD",
  "location_id": 1,
  "branch": 1
}
```

### Full Property with Relations
See `examples/create-property-with-relations.json` for complete example.

---

## 🏗️ Architecture

### System Flow

```
Client Request (JSON)
    ↓
ValidationPipe (validate DTO)
    ↓
PropertiesController
    ↓
PropertiesService.createWithRelations()
    ├─ Create Property
    ├─ Insert Images (FK)
    ├─ Insert Tags (FK)
    ├─ Insert Operations (FK)
    └─ Load relations
    ↓
201 Created + Full Property JSON
```

### Database Schema

```
properties (1:N) ──┬─── property_images
                   ├─── property_tags
                   ├─── property_operations
                   └─── property_attributes
```

- **properties**: 50+ columns for property data
- **property_images**: Photos/blueprints (FK → properties)
- **property_tags**: Tags (servicios=1, ambientes=2, adicionales=3)
- **property_operations**: Sale/rental info
- **property_attributes**: Flexible key-value pairs

### Relationships

- All relations have **CASCADE DELETE**
- All use **Foreign Keys** to maintain integrity
- Indexes on frequently queried columns
- Soft delete pattern (deleted flag + deleted_at timestamp)

### Service Method

```typescript
async createWithRelations(dto: CreatePropertyWithRelationsDto): Promise<Property> {
  // 1. Extract relations from DTO
  const { images, tags, operations, ...propertyData } = dto;
  
  // 2. Validate reference_code unique
  const existing = await propertyRepository.findOne({
    where: { reference_code: propertyData.reference_code }
  });
  if (existing) throw new BadRequestException('Code already exists');
  
  // 3. Create Property
  const savedProperty = await propertyRepository.save(propertyData);
  
  // 4. Create relations
  for (const image of images) {
    await propertyImageRepository.save({ ...image, property: savedProperty });
  }
  for (const tag of tags) {
    await propertyTagRepository.save({ ...tag, property: savedProperty });
  }
  for (const operation of operations) {
    await propertyOperationRepository.save({ ...operation, property: savedProperty });
  }
  
  // 5. Load and return
  return this.findOne(savedProperty.id);
}
```

---

## 📂 Project Structure

```
src/modules/properties/
├── properties.controller.ts      (✏️ POST /properties/with-relations)
├── properties.service.ts         (✏️ createWithRelations() method)
├── properties.module.ts
├── entities/
│   ├── property.entity.ts
│   ├── property-image.entity.ts
│   ├── property-tag.entity.ts
│   ├── property-operation.entity.ts
│   └── property-attribute.entity.ts
└── dto/
    ├── create-property.dto.ts
    ├── create-property-with-relations.dto.ts
    └── update-property.dto.ts
```

---

## 🔧 Development Commands

```bash
npm install              # Install dependencies
npm run start:dev        # Development server (hot reload)
npm run build           # Build for production
npm start               # Production server
npm test                # Run tests
npm run test:watch      # Tests in watch mode
npm run lint            # ESLint
npm run format          # Prettier formatting
```

---

## 🐳 Docker

```bash
# Start all services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f api
```

---

## 🔐 Security

✅ Input validation at entry point  
✅ SQL injection prevention (TypeORM parameterized queries)  
✅ JWT token-based authentication  
✅ Global exception handling (no sensitive info leaks)  
✅ Type safety with TypeScript strict mode  
✅ Database constraints enforce data integrity  

---

## 📊 Status

✅ Endpoint fully implemented  
✅ All validations working  
✅ Zero TypeScript errors  
✅ Production-ready  
✅ Ready to use  

---

## 📄 Files

| File | Purpose |
|------|---------|
| **README.md** | This file - complete guide |
| **ARCHITECTURE.md** | System design details |
| **PROPERTIES_WITH_RELATIONS.md** | Endpoint specification |
| **examples/create-property-with-relations.json** | Example JSON payload |

---

## 🚀 Next Steps

1. ✅ Run `npm start`
2. ✅ Copy Quick Start PowerShell command
3. ✅ Execute and see property created
4. ✅ Explore other endpoints with GET, PATCH, DELETE

---

## 📞 Support

- Check **README.md** (this file) for quick answers
- See **ARCHITECTURE.md** for system design
- See **examples/create-property-with-relations.json** for JSON format
- Check logs: `docker-compose logs -f api`

---

**Version:** 1.0  
**Updated:** 2024-01-15  
**Status:** ✅ Production Ready
        @{ tag_id = 1; tag_name = "Agua"; tag_type = 1 },
        @{ tag_id = 34; tag_name = "Gas"; tag_type = 1 },
        @{ tag_id = 152; tag_name = "Piscina"; tag_type = 3 },
        @{ tag_id = 91; tag_name = "Lavadero"; tag_type = 2 },
        @{ tag_id = 162; tag_name = "Ascensor"; tag_type = 3 },
        @{ tag_id = 93; tag_name = "Terraza"; tag_type = 2 }
    )
    operations = @(
        @{ operation_type = "venta"; currency = "USD"; price = 100000 }
    )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:3000/properties/with-relations" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body | ConvertTo-Json
```

### 3. See response:
```json
{
  "id": 1,
  "reference_code": "TEST-001",
  "images": [{"id": 1}, {"id": 2}],
  "tags": [{"id": 1}, ..., {"id": 6}],
  "operations": [{"id": 1}]
}
```

✅ **Success! Property created with 2 images, 6 tags, 1 operation**

---

## 📚 Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [API Endpoints](#api-endpoints)
4. [Required Fields](#required-fields)
5. [Testing](#testing)
6. [Installation](#installation)
7. [Database Setup](#database-setup)
8. [Validation](#validation)
9. [Error Handling](#error-handling)
10. [Examples](#examples)

---

## ✨ Features

✅ **Create properties with relationships in ONE request**
- Add 2+ images
- Add 6+ tags (servicios, ambientes, adicionales)
- Add 1+ operations (venta, alquiler, etc.)

✅ **Production-Ready**
- NestJS 10.3 with TypeScript 5
- TypeORM with PostgreSQL 16
- JWT Authentication
- Global validation with class-validator
- Soft delete pattern
- Cascade delete relationships

✅ **Full CRUD Operations**
- POST /properties/with-relations (⭐ Main endpoint)
- POST /properties (simple)
- GET /properties (list, filter, paginate)
- GET /properties/:id (with relations)
- PATCH /properties/:id (update)
- DELETE /properties/:id (soft delete)
- PATCH /properties/:id/restore (undo delete)
- GET /properties/stats (statistics)
- GET /properties/search?q=... (text search)

✅ **Validation at 3 Levels**
- DTO validation (class-validator decorators)
- Service validation (business logic)
- Database constraints (UNIQUE, FK, NOT NULL)

---

## 🏗️ Architecture

### Diagram Flow

```
CLIENT REQUEST (JSON)
       ↓
POST /properties/with-relations
       ↓
ValidationPipe (validates DTO)
       ↓
PropertiesController
       ↓
PropertiesService.createWithRelations()
       ├─ 1. Create Property
       ├─ 2. Insert PropertyImages (FK: property_id)
       ├─ 3. Insert PropertyTags (FK: property_id)
       ├─ 4. Insert PropertyOperations (FK: property_id)
       └─ 5. Load all relations
       ↓
201 Created + Full Property JSON
```

### Entity Relationships

```
Property (1:N)
├── PropertyImage (url, is_blueprint, order_position)
├── PropertyTag (tag_id, tag_name, tag_type: 1|2|3)
├── PropertyOperation (operation_type, currency, price, period)
└── PropertyAttribute (code, value)
```

### Service Implementation

```typescript
async createWithRelations(dto: CreatePropertyWithRelationsDto): Promise<Property> {
  1. Validate reference_code is unique
  2. Create Property base record
  3. For each image in dto.images[] → Insert PropertyImage
  4. For each tag in dto.tags[] → Insert PropertyTag
  5. For each operation in dto.operations[] → Insert PropertyOperation
  6. Return property.findOne() with all relations loaded
}
```

---

## 🔌 API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| **POST** | **/properties/with-relations** | ⭐ Create property + images + tags + operations |
| POST | /properties | Create simple property |
| GET | /properties | List (filters, pagination) |
| GET | /properties/:id | Get by ID (with relations) |
| GET | /properties/ref/:code | Get by reference_code |
| PATCH | /properties/:id | Update property |
| DELETE | /properties/:id | Soft delete |
| PATCH | /properties/:id/restore | Restore deleted |
| GET | /properties/stats | Statistics |
| GET | /properties/search?q=text | Text search |

---

## 📋 Required Fields

All these fields are **mandatory**:

```json
{
  "reference_code": "PROP-001",        // ⭐ Unique identifier
  "publication_title": "Casa",         // ⭐ Property title
  "property_type": 2,                  // ⭐ Type code
  "status": 1,                         // ⭐ Status code
  "operation_type": "venta",           // ⭐ "venta" | "alquiler" | etc
  "price": 100000,                     // ⭐ Must be > 0
  "currency": "USD"                    // ⭐ ISO code (USD, ARS, EUR)
}
```

### Common Optional Fields

```json
{
  "location_id": 1,
  "branch": 1,
  "street": "Av. Principal 123",
  "number": "123",
  "apartment": "4A",
  "city": "Buenos Aires",
  "state": "Buenos Aires",
  "country": "Argentina",
  "postal_code": "1000",
  "geo_lat": -34.6037,                 // -90 to 90
  "geo_long": -58.3816,                // -180 to 180
  "owner_name": "Juan Pérez",
  "owner_email": "juan@example.com",
  "owner_phone": "+5491123456789",
  "total_surface": 250,
  "land_surface": 500,
  "room_amount": 3,
  "bathroom_amount": 2,
  "garage_spots": 2,
  "construction_year": 2015,
  "last_renovation": 2020,
  "description": "Beautiful house with pool"
}
```

### Related Data Arrays (Optional)

```json
{
  "images": [
    {
      "url": "https://example.com/image1.jpg",
      "is_blueprint": false,
      "description": "Front view",
      "order_position": 1
    },
    {
      "url": "https://example.com/blueprint.jpg",
      "is_blueprint": true,
      "description": "Floor plan",
      "order_position": 2
    }
  ],
  
  "tags": [
    { "tag_id": 1, "tag_name": "Agua Corriente", "tag_type": 1 },      // Servicios
    { "tag_id": 34, "tag_name": "Gas Natural", "tag_type": 1 },         // Servicios
    { "tag_id": 152, "tag_name": "Piscina", "tag_type": 3 },            // Adicionales
    { "tag_id": 91, "tag_name": "Lavadero", "tag_type": 2 },            // Ambientes
    { "tag_id": 162, "tag_name": "Ascensor", "tag_type": 3 },           // Adicionales
    { "tag_id": 93, "tag_name": "Terraza", "tag_type": 2 }              // Ambientes
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

---

## 🧪 Testing

### Option 1: PowerShell (Windows - Recommended)
```powershell
# Copy/paste the Quick Start command above
```

### Option 2: cURL (Linux/macOS)
```bash
curl -X POST http://localhost:3000/properties/with-relations \
  -H "Content-Type: application/json" \
  -d @examples/create-property-with-relations.json
```

### Option 3: Postman
1. Method: **POST**
2. URL: `http://localhost:3000/properties/with-relations`
3. Headers: `Content-Type: application/json`
4. Body (raw): Copy from `examples/create-property-with-relations.json`
5. Send

### Option 4: Thunder Client (VS Code)
1. Install "Thunder Client" extension
2. New Request → POST
3. URL: `http://localhost:3000/properties/with-relations`
4. Body: Paste JSON
5. Send

### Option 5: JavaScript/Fetch
```javascript
const property = { /* ... */ };

fetch('http://localhost:3000/properties/with-relations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(property)
})
.then(r => r.json())
.then(data => console.log('Created:', data))
.catch(e => console.error('Error:', e));
```

### Option 6: Axios
```javascript
const axios = require('axios');

axios.post('http://localhost:3000/properties/with-relations', property)
  .then(res => console.log('Created:', res.data))
  .catch(err => console.error('Error:', err.response.data));
```

---

## 📦 Installation

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- npm or yarn

### Steps

1. **Install dependencies**
```bash
npm install
```

2. **Create environment file**
```bash
cp .env.example .env
```

3. **Configure database** (edit `.env`)
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=metroprop_db
JWT_SECRET=your_secret_key
PORT=3000
NODE_ENV=development
```

4. **Run migrations** (if using TypeORM migrations)
```bash
npm run typeorm migration:run
```

5. **Start development server**
```bash
npm run start:dev
```

6. **Test endpoint**
```bash
curl http://localhost:3000/properties/stats
```

---

## � SendGrid Email Configuration

MetroProp uses SendGrid for reliable email delivery. Configure the following environment variables:

### 1. Get SendGrid API Key
1. Sign up at [SendGrid](https://sendgrid.com/)
2. Go to Settings > API Keys
3. Create a new API key with Mail Send permissions

### 2. Configure Environment Variables
Add to your `.env` file:

```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourapp.com
SENDGRID_FROM_NAME=MetroProp
```

### 3. Domain Authentication (Production)
For production, configure domain authentication in SendGrid:
- Go to Settings > Sender Authentication
- Set up Domain Authentication
- Update `SENDGRID_FROM_EMAIL` to use your authenticated domain

### 4. Email Templates
The following emails are automatically sent:
- **Welcome emails** - User registration verification
- **Professional welcome emails** - Professional user verification  
- **Password reset emails** - Password recovery

### 5. Testing Email Sending
```bash
# Test email functionality via API
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","password":"password123"}'
```

---

## �🗄️ Database Setup

### Option A: Docker (Recommended)
```bash
docker-compose up -d
```

### Option B: Local PostgreSQL
```sql
-- Create database
CREATE DATABASE metroprop_db;

-- Connect to database
\c metroprop_db;

-- Create tables (TypeORM will handle this with entities)
-- Or run migrations if you have them
```

### Database Tables
- `properties` - Main property records (50+ columns)
- `property_images` - Property photos/blueprints
- `property_tags` - Tags (servicios, ambientes, adicionales)
- `property_operations` - Multiple operations per property
- `property_attributes` - Flexible key-value attributes
- `users`, `roles`, `permissions` - Authentication

### Indexes
- `idx_properties_status`
- `idx_properties_property_type`
- `idx_properties_location_id`
- `idx_properties_reference_code`
- `idx_properties_branch`

---

## ✅ Validation

### What Gets Validated

| Field | Rules |
|-------|-------|
| `reference_code` | MinLength: 1, MaxLength: 100, Unique in DB |
| `publication_title` | MinLength: 1, MaxLength: 500, Required |
| `property_type` | IsNumber, Required |
| `status` | IsNumber, Required |
| `operation_type` | String, Required |
| `price` | IsPositive, IsNumber, Required |
| `currency` | Matches: ^[A-Z]{3}$ (ISO), Required |
| `geo_lat` | Min: -90, Max: 90 |
| `geo_long` | Min: -180, Max: 180 |
| Numeric amounts | Min: 0 |

### Validation Levels

1. **DTO Level** - class-validator decorators
2. **Service Level** - Business logic (reference_code uniqueness)
3. **Database Level** - Constraints (UNIQUE, NOT NULL, FK)

---

## ❌ Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 400: "Una propiedad con este código..." | Duplicate reference_code | Use unique code |
| 400: "price must be positive" | price ≤ 0 | Use price > 0 |
| 400: "currency must match ^[A-Z]{3}$" | Invalid currency format | Use USD, ARS, EUR, etc |
| 400: "publication_title should not be empty" | Missing/empty title | Provide title |
| 400: Validation error | Invalid field format | Check field type/format |
| 500: Internal Server Error | DB connection or server error | Check logs, verify DB |
| 404: Not Found | Resource doesn't exist | Verify ID/code |

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 201 | Created - Property created successfully ✅ |
| 400 | Bad Request - Validation failed |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Error - Server/DB problem |

---

## 📝 Examples

### Minimal Property
```json
{
  "reference_code": "PROP-001",
  "publication_title": "Casa",
  "property_type": 2,
  "status": 1,
  "operation_type": "venta",
  "price": 100000,
  "currency": "USD",
  "location_id": 1,
  "branch": 1
}
```

### Complete Property with Relations
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
  "construction_year": 2015,
  "last_renovation": 2020,
  "geo_lat": -34.6037,
  "geo_long": -58.3816,
  "total_surface": 250,
  "land_surface": 500,
  "room_amount": 3,
  "bathroom_amount": 2,
  "garage_spots": 2,
  "amenities": "Pool, garden, grill",
  "description": "Beautiful house with all services",
  "images": [
    {
      "url": "https://example.com/images/property-1.jpg",
      "is_blueprint": false,
      "description": "Front of house",
      "order_position": 1
    },
    {
      "url": "https://example.com/images/property-2.jpg",
      "is_blueprint": true,
      "description": "Floor plan",
      "order_position": 2
    }
  ],
  "tags": [
    {
      "tag_id": 1,
      "tag_name": "Agua Corriente",
      "tag_type": 1
    },
    {
      "tag_id": 34,
      "tag_name": "Gas Natural",
      "tag_type": 1
    },
    {
      "tag_id": 152,
      "tag_name": "Piscina",
      "tag_type": 3
    },
    {
      "tag_id": 91,
      "tag_name": "Lavadero",
      "tag_type": 2
    },
    {
      "tag_id": 162,
      "tag_name": "Ascensor",
      "tag_type": 3
    },
    {
      "tag_id": 93,
      "tag_name": "Terraza",
      "tag_type": 2
    }
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

### Success Response (201 Created)
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
      "description": "Front of house",
      "order_position": 1,
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": 2,
      "url": "https://example.com/images/property-2.jpg",
      "is_blueprint": true,
      "description": "Floor plan",
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
    {
      "id": 2,
      "tag_id": 34,
      "tag_name": "Gas Natural",
      "tag_type": 1,
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": 3,
      "tag_id": 152,
      "tag_name": "Piscina",
      "tag_type": 3,
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": 4,
      "tag_id": 91,
      "tag_name": "Lavadero",
      "tag_type": 2,
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": 5,
      "tag_id": 162,
      "tag_name": "Ascensor",
      "tag_type": 3,
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": 6,
      "tag_id": 93,
      "tag_name": "Terraza",
      "tag_type": 2,
      "created_at": "2024-01-15T10:30:00Z"
    }
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

---

## 🚀 Advanced Usage

### Retrieve Created Property
```bash
curl http://localhost:3000/properties/1
```

### List All Properties (with pagination)
```bash
curl "http://localhost:3000/properties?skip=0&take=10"
```

### Search Properties
```bash
curl "http://localhost:3000/properties/search?q=Casa"
```

### Get Statistics
```bash
curl http://localhost:3000/properties/stats
```

### Update Property
```bash
curl -X PATCH http://localhost:3000/properties/1 \
  -H "Content-Type: application/json" \
  -d '{"publication_title": "Updated Title"}'
```

### Soft Delete
```bash
curl -X DELETE http://localhost:3000/properties/1
```

### Restore Deleted
```bash
curl -X PATCH http://localhost:3000/properties/1/restore
```

---

## 📂 Project Structure

```
metroprop_back-main/
├── src/
│   ├── modules/
│   │   ├── properties/
│   │   │   ├── properties.service.ts       ← createWithRelations() method
│   │   │   ├── properties.controller.ts    ← POST /properties/with-relations
│   │   │   ├── properties.module.ts
│   │   │   ├── entities/
│   │   │   │   ├── property.entity.ts
│   │   │   │   ├── property-image.entity.ts
│   │   │   │   ├── property-tag.entity.ts
│   │   │   │   └── property-operation.entity.ts
│   │   │   └── dto/
│   │   │       ├── create-property.dto.ts
│   │   │       ├── create-property-with-relations.dto.ts
│   │   │       └── update-property.dto.ts
│   │   ├── auth/
│   │   ├── users/
│   │   ├── roles/
│   │   └── ...
│   ├── common/
│   ├── app.module.ts
│   ├── main.ts
│   └── ...
├── examples/
│   └── create-property-with-relations.json  ← Example JSON
├── sql/
│   ├── properties.sql
│   ├── tags.sql
│   └── attributes.sql
├── README.md                                 ← This file
├── package.json
├── tsconfig.json
├── docker-compose.yml
└── Dockerfile
```

---

## 🔧 Development Commands

```bash
# Install dependencies
npm install

# Development server (with hot reload)
npm run start:dev

# Production build
npm run build

# Production server
npm start

# Run tests
npm run test

# Run tests (watch mode)
npm run test:watch

# Linting
npm run lint

# Code formatting
npm run format
```

---

## 🐳 Docker

### Build and Run
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f api
docker-compose logs -f postgres
```

---

## 📊 Entity Relationships Diagram

```
properties (1:N) ──┬─── property_images
                   ├─── property_tags
                   ├─── property_operations
                   └─── property_attributes

Property
├─ id (PK, auto-increment)
├─ reference_code (UNIQUE)
├─ publication_title
├─ property_type
├─ status
├─ operation_type
├─ price
├─ currency
├─ ... 40+ fields ...
├─ deleted (soft delete)
├─ deleted_at
├─ created_at (auto)
└─ updated_at (auto)
```

---

## ⚙️ Configuration

### Environment Variables
```env
# Server
PORT=3000
NODE_ENV=development|production

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=metroprop_db

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=24h

# Logging
LOG_LEVEL=debug|info|warn|error
```

---

## 📖 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [class-validator Documentation](https://github.com/typestack/class-validator)

---

## 🆘 Troubleshooting

### Server won't start
```bash
# Check if port 3000 is already in use
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows
```

### Database connection error
```bash
# Verify PostgreSQL is running
psql -U postgres -h localhost -c "SELECT 1"

# Check credentials in .env
```

### Tests failing
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm test
```

---

## 📄 License

MIT

---

## ✅ Implementation Status

- ✅ POST /properties/with-relations endpoint
- ✅ Property creation with images, tags, operations
- ✅ Complete validation (DTO, Service, DB)
- ✅ Full CRUD operations
- ✅ Soft delete pattern
- ✅ Cascade delete relationships
- ✅ Zero TypeScript errors
- ✅ Production-ready code

---

**Last Updated:** 2024-01-15  
**Version:** 1.0  
**Status:** ✅ Ready to Use

For quick start, see [⚡ Quick Start section](#-quick-start-30-seconds) above.

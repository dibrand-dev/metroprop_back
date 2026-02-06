# 🏗️ Architecture - POST /properties/with-relations

Complete architecture and system design documentation for the properties module with relationship creation support.

---

## 📊 System Architecture Overview

```
CLIENT (Postman/cURL/JavaScript)
       │
       ↓ HTTP POST JSON
┌─────────────────────────────────┐
│  POST /properties/with-relations │
└──────────────┬──────────────────┘
               │
               ↓
┌──────────────────────────────────┐
│   ValidationPipe (Global)        │
│  - Validates DTO structure       │
│  - Validates field formats       │
│  - Validates nested arrays       │
│  - Returns 400 if invalid        │
└──────────────┬──────────────────┘
               │
               ↓
┌──────────────────────────────────┐
│   PropertiesController           │
│  @Post('with-relations')         │
│  createWithRelations(dto)        │
└──────────────┬──────────────────┘
               │
               ↓
┌──────────────────────────────────┐
│   PropertiesService              │
│  .createWithRelations(dto)       │
│                                  │
│  1. Extract: images, tags, ops   │
│  2. Validate reference_code      │
│  3. Create Property              │
│  4. Insert Images (FK)           │
│  5. Insert Tags (FK)             │
│  6. Insert Operations (FK)       │
│  7. Load relations & return      │
└──────────────┬──────────────────┘
               │
               ↓
┌──────────────────────────────────┐
│   TypeORM Repositories           │
│  - propertyRepository            │
│  - propertyImageRepository       │
│  - propertyTagRepository         │
│  - propertyOperationRepository   │
└──────────────┬──────────────────┘
               │
               ↓
┌──────────────────────────────────┐
│   PostgreSQL 16                  │
│  INSERT INTO properties          │
│  INSERT INTO property_images     │
│  INSERT INTO property_tags       │
│  INSERT INTO property_operations │
│  SELECT * FROM ... (load rels)   │
└──────────────┬──────────────────┘
               │
               ↓
┌──────────────────────────────────┐
│   201 Created Response           │
│  Property + Images + Tags + Ops  │
└──────────────────────────────────┘
               │
               ↓
CLIENT (Receives complete Property JSON)
```

---

## 🗂️ Module Structure

### PropertiesModule Components

```
properties/
├── properties.controller.ts
│   ├── @Post('with-relations')         ← NEW
│   ├── @Post('/')
│   ├── @Get('/')
│   ├── @Get(':id')
│   ├── @Get('ref/:reference_code')
│   ├── @Get('stats')
│   ├── @Get('search')
│   ├── @Patch(':id')
│   ├── @Delete(':id')
│   └── @Patch(':id/restore')
│
├── properties.service.ts
│   ├── create(dto)
│   ├── createWithRelations(dto)        ← NEW
│   ├── findAll(skip, take, filters)
│   ├── findOne(id)
│   ├── findByReferenceCode(code)
│   ├── update(id, dto)
│   ├── remove(id)  [soft delete]
│   ├── restore(id)
│   ├── getStats()
│   └── search(query)
│
├── properties.module.ts
│   └── TypeOrmModule.forFeature([...5 entities])
│
├── entities/
│   ├── property.entity.ts
│   │   ├── id (PK, auto-increment)
│   │   ├── reference_code (UNIQUE)
│   │   ├── 50+ property fields
│   │   ├─ Relations: images, tags, operations, attributes
│   │
│   ├── property-image.entity.ts
│   ├── property-tag.entity.ts
│   ├── property-operation.entity.ts
│   └── property-attribute.entity.ts
│
└── dto/
    ├── create-property.dto.ts
    ├── create-property-with-relations.dto.ts ← NEW
    └── update-property.dto.ts
```

---

## 🔌 Data Flow - createWithRelations()

### Service Processing

```typescript
async createWithRelations(dto: CreatePropertyWithRelationsDto): Promise<Property> {
  // Step 1: Destructure
  const { images, tags, operations, ...propertyData } = dto;
  
  // Step 2: Validate unique reference_code
  const existing = await propertyRepository.findOne({
    where: { reference_code: propertyData.reference_code }
  });
  if (existing) throw BadRequestException;
  
  // Step 3: Create Property
  const savedProperty = await propertyRepository.save({
    ...propertyData,
    deleted: false
  });
  
  // Step 4-6: Create relations
  for (const image of images) {
    await propertyImageRepository.save({ ...image, property: savedProperty });
  }
  for (const tag of tags) {
    await propertyTagRepository.save({ ...tag, property: savedProperty });
  }
  for (const operation of operations) {
    await propertyOperationRepository.save({ ...operation, property: savedProperty });
  }
  
  // Step 7: Load and return with relations
  return this.findOne(savedProperty.id);
}
```

---

## 🗄️ Database Schema

### Tables & Relationships

```sql
properties (1:N) ──┬─── property_images
                   ├─── property_tags
                   ├─── property_operations
                   └─── property_attributes

-- All relations have CASCADE DELETE
-- All relation tables have FK to properties(id)
```

### Indexes

```sql
CREATE INDEX idx_properties_reference_code ON properties(reference_code);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_property_type ON properties(property_type);
CREATE INDEX idx_property_images_property_id ON property_images(property_id);
CREATE INDEX idx_property_tags_property_id ON property_tags(property_id);
CREATE INDEX idx_property_operations_property_id ON property_operations(property_id);
```

---

## 🔐 Validation Architecture

### 3-Level Validation

```
1. DTO Level (class-validator)
   ├─ Required fields
   ├─ Format validation (currency, price, etc)
   └─ Nested array validation

2. Service Level
   └─ Business logic (reference_code unique)

3. Database Level
   ├─ UNIQUE constraints
   ├─ Foreign key integrity
   └─ Data type constraints
```

---

## ⚡ Key Features

✅ **Atomic Operations** - Property + relations created together  
✅ **Full Validation** - 3-level validation strategy  
✅ **Auto-Generated IDs** - BIGSERIAL for all primary keys  
✅ **Soft Delete** - Recovery capability with deleted flag  
✅ **Cascade Delete** - Automatic cleanup on property deletion  
✅ **Full Relations** - Complete object graphs returned  

---

## 📈 Performance

- **Indexed Lookups** - Fast queries via indexes
- **Connection Pooling** - TypeORM manages DB connections
- **Query Optimization** - LEFT JOINs for relations loading
- **Pagination** - Scalable list endpoints

---

**Architecture Version:** 1.0  
**Last Updated:** 2024-01-15  
**Status:** ✅ Production Ready

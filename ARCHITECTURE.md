# MetroProp Backend - 2026 Modern NestJS Stack

## Project Overview

A production-ready, enterprise-grade backend API built with NestJS, PostgreSQL, and TypeScript. This project demonstrates modern 2026 best practices for building scalable Node.js applications.

## 🎯 Key Features

### Core Framework
- **NestJS 10** - Progressive Node.js framework with built-in DI, modules, and decorators
- **TypeScript 5** - Full type safety with strict mode enabled
- **TypeORM 0.3** - Modern ORM with migrations, relationships, and query builder

### Authentication & Security
- **JWT Tokens** - Secure token-based authentication
- **Passport.js** - Strategy-based authentication framework
- **bcryptjs** - Industry-standard password hashing

### API Features
- **Class Validation** - Automatic DTO validation with class-validator
- **Global Exception Handling** - Centralized error management
- **Pagination** - Built-in pagination for list endpoints
- **Filtering** - Advanced filtering capabilities
- **CORS** - Configurable Cross-Origin Resource Sharing

### Development Experience
- **Hot Reload** - Automatic restart on file changes
- **ESLint & Prettier** - Code quality and consistent formatting
- **Jest Testing** - Comprehensive testing framework
- **TypeScript Strict** - Maximum type safety

### DevOps Ready
- **Docker Support** - Multi-stage Docker builds
- **Docker Compose** - Complete local development environment
- **Environment Configuration** - 12-factor app principles
- **Health Checks** - Service health monitoring

## 📊 Technology Stack

```
Frontend Layer: REST API (HTTP)
│
├─ NestJS Framework
├─ Express.js (underlying)
├─ Passport.js (Authentication)
├─ JWT (Tokens)
│
├─ TypeORM (Data Access)
│
└─ PostgreSQL (Data Persistence)
   └─ pgAdmin (Management)
```

## 🏗️ Architecture Pattern: Modular Monolith

```
AppModule (Root)
├── AuthModule
│   ├── AuthService
│   ├── AuthController
│   ├── JwtStrategy
│   └── Entities
│
├── UsersModule
│   ├── UsersService
│   ├── UsersController
│   ├── User Entity
│   └── DTOs
│
├── PropertiesModule
│   ├── PropertiesService
│   ├── PropertiesController
│   ├── Property Entity
│   └── DTOs
│
└── Shared (Common)
    ├── Filters (Exception handling)
    └── Guards (JWT Auth)
```

## 🔐 Authentication Flow

```
User Login (POST /auth/login)
    ↓
Verify Credentials (bcryptjs)
    ↓
Generate JWT Token (JwtService)
    ↓
Return Token + User Info
    ↓
Protected Endpoint (Authorization: Bearer TOKEN)
    ↓
JwtAuthGuard (Passport)
    ↓
JWT Validation (JwtStrategy)
    ↓
Request Handler
```

## 📝 API Endpoint Structure

### Public Endpoints
- `POST /users` - Register new user
- `POST /auth/login` - Login and get token
- `GET /properties` - List all properties
- `GET /properties/:id` - Property details

### Protected Endpoints (require JWT)
- `PATCH /users/:id` - Update profile
- `DELETE /users/:id` - Delete account
- `POST /properties` - Create property
- `PATCH /properties/:id` - Update property
- `DELETE /properties/:id` - Delete property

### System Endpoints
- `GET /` - Welcome message
- `GET /health` - Health check

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  phone VARCHAR(50),
  bio TEXT,
  avatar VARCHAR(255),
  role ENUM ('user', 'agent', 'admin'),
  isVerified BOOLEAN,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

### Properties Table
```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY,
  title VARCHAR(255),
  description TEXT,
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  zipCode VARCHAR(20),
  price DECIMAL(10, 2),
  area DECIMAL(10, 2),
  bedrooms INTEGER,
  bathrooms INTEGER,
  amenities TEXT[],
  images TEXT[],
  propertyType ENUM ('apartment', 'house', 'land', 'commercial'),
  status ENUM ('available', 'sold', 'rented'),
  latitude DECIMAL(11, 8),
  longitude DECIMAL(11, 8),
  ownerId UUID FOREIGN KEY,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

## 🚀 Deployment Architecture

```
                    ┌─────────────┐
                    │   CDN/LB    │
                    └──────┬──────┘
                           │
                ┌──────────┴──────────┐
                │                     │
          ┌─────▼────┐          ┌─────▼────┐
          │ App Pod 1 │          │ App Pod 2 │
          │ (NestJS)  │          │ (NestJS)  │
          └─────┬────┘          └─────┬────┘
                │                     │
                └──────────┬──────────┘
                           │
                    ┌──────▼──────┐
                    │ PostgreSQL  │
                    │ (RDS/Cloud) │
                    └─────────────┘
```

## 📦 Project Dependencies

### Core Framework (8 packages)
- @nestjs/common, @nestjs/core, @nestjs/platform-express

### Database & ORM (2 packages)
- typeorm, pg, @nestjs/typeorm

### Authentication (3 packages)
- @nestjs/jwt, @nestjs/passport, passport-jwt, passport

### Validation (2 packages)
- class-validator, class-transformer

### Configuration (2 packages)
- @nestjs/config, dotenv

### Utilities (2 packages)
- bcryptjs, reflect-metadata, rxjs

Total: ~20 production dependencies, ~30 dev dependencies

## 🎯 Design Decisions

1. **Modular Structure** - Each feature is a complete module with service, controller, and DTOs
2. **Separation of Concerns** - Clear boundaries between layers
3. **Convention over Configuration** - Following NestJS conventions
4. **Type Safety** - Strict TypeScript for fewer runtime errors
5. **Scalability** - Ready for horizontal scaling
6. **Security First** - JWT, password hashing, input validation
7. **API Versioning Ready** - Controllers can be extended with versioning
8. **Migration Support** - Database versioning capability

## 🔄 Request/Response Cycle

```
HTTP Request
    ↓
Route Matching (Controller)
    ↓
Global Guards (JWT Auth)
    ↓
Guard Validation
    ↓
Controller Handler
    ↓
ValidationPipe (DTO validation)
    ↓
Service Layer (Business Logic)
    ↓
TypeORM Query
    ↓
Database Operation
    ↓
Service returns data
    ↓
Controller formats response
    ↓
Global Exception Filter (if error)
    ↓
HTTP Response
```

## 📊 Performance Considerations

1. **Database Indexes** - Defined on frequently queried fields (email, ownerId)
2. **Pagination** - All list endpoints support limit/offset
3. **Lazy Loading** - Relations loaded on demand
4. **Query Builder** - Optimized queries for complex filtering
5. **Connection Pooling** - TypeORM manages connection pool
6. **Caching Ready** - Can integrate Redis/Memcached
7. **Middleware Support** - Compression, rate limiting ready

## 🧪 Testing Strategy

```
Unit Tests (Services)
    ↓ Mock Dependencies
    ↓
Controller Tests
    ↓ Mock Services
    ↓
E2E Tests
    ↓ Real Database
    ↓
API Contracts
```

## 🔐 Security Checklist

- ✅ JWT Token-based authentication
- ✅ Password hashing (bcryptjs)
- ✅ SQL Injection Prevention (TypeORM)
- ✅ Input Validation (class-validator)
- ✅ CORS Configuration
- ✅ Environment Secret Management
- ✅ Global Exception Handling (no stack traces in production)
- ✅ Type Safety (TypeScript strict mode)

## 📈 Scalability Path

### Phase 1 (Current)
- Single server monolith
- PostgreSQL primary database

### Phase 2 (Recommended)
- Multiple API instances (load balanced)
- Redis for caching & sessions
- Database read replicas

### Phase 3 (Advanced)
- Microservices extraction
- Message queue (RabbitMQ/Kafka)
- API Gateway
- Event-driven architecture

## 🛠️ Development Workflow

1. **Create Feature Branch** `git checkout -b feature/your-feature`
2. **Run Dev Server** `npm run start:dev`
3. **Write/Update Code** with auto-reload
4. **Test Locally** against API
5. **Run Tests** `npm run test`
6. **Lint & Format** `npm run lint && npm run format`
7. **Commit & Push** `git push origin feature/your-feature`
8. **Create PR** for code review
9. **CI/CD Pipeline** (automated tests)
10. **Merge & Deploy** to production

## 📚 Learning Resources

- [NestJS Official Docs](https://docs.nestjs.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TypeORM Documentation](https://typeorm.io)
- [RESTful API Design](https://restfulapi.net)
- [JWT Introduction](https://jwt.io)

## 🎓 Next Learning Steps

1. Add Swagger/OpenAPI documentation
2. Implement rate limiting
3. Add file upload support
4. Implement soft deletes
5. Add audit logging
6. Implement caching
7. Add real-time features (WebSockets)
8. Implement database migrations
9. Add monitoring & logging
10. Deploy to cloud platform

---

**Built with Modern NestJS Practices - February 2026**

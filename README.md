# MetroProp Backend - Modern NestJS PostgreSQL API

A production-ready NestJS backend application with PostgreSQL, featuring modern 2026 best practices, authentication, validation, and comprehensive error handling.

## 🚀 Features

- **NestJS 10.3** - Latest framework with modular architecture
- **TypeORM 0.3** - Modern ORM with migrations support
- **PostgreSQL 16** - Latest database with Alpine image
- **JWT Authentication** - Secure token-based auth
- **Class Validation** - DTO-based request validation
- **Global Exception Filter** - Centralized error handling
- **Docker Support** - Docker & Docker Compose ready
- **Type Safety** - Full TypeScript with strict mode
- **Testing Ready** - Jest configuration included
- **ESLint & Prettier** - Code quality and formatting

## 📋 Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or use Docker)
- npm or yarn

## 🛠️ Installation

1. **Clone and Setup**
```bash
cd metroprop_back
npm install
```

2. **Environment Configuration**
```bash
cp .env.example .env
```

Edit `.env` with your database credentials:
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=metroprop_db
JWT_SECRET=your_super_secret_key_change_in_production
```

3. **Database Setup**

**Option A: Using Docker**
```bash
docker-compose up -d postgres
```

**Option B: Local PostgreSQL**
```bash
createdb metroprop_db
```

## 🚀 Running the Application

### Development Mode
```bash
npm run start:dev
```

### Production Mode
```bash
npm run build
npm run start:prod
```

### With Docker
```bash
docker-compose up
```

The API will be available at `http://localhost:3000`

## 📚 API Endpoints

### Health Check
- `GET /` - Welcome message
- `GET /health` - API health status

### Authentication
- `POST /auth/login` - Login with email/password
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

### Users
- `POST /users` - Create user
- `GET /users` - List all users (paginated)
- `GET /users/:id` - Get user by ID
- `PATCH /users/:id` - Update user (requires JWT)
- `DELETE /users/:id` - Delete user (requires JWT)
 
### Query Parameters
- `limit` - Number of results (default: 10)
- `offset` - Pagination offset (default: 0)
 
## 🔐 Authentication

1. **Register a User**
```bash
POST /users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "phone": "+1234567890"
}
```

2. **Login**
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

3. **Use Token in Requests**
```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📦 Project Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts             # Root module
├── app.controller.ts         # Root controller
├── app.service.ts            # Root service
├── common/
│   ├── filters/
│   │   └── all-exceptions.filter.ts
│   └── guards/
│       └── jwt-auth.guard.ts
├── modules/
│   ├── auth/
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   └── dto/
│   │       └── login.dto.ts
│   └── users/
│      ├── users.service.ts
│      ├── users.controller.ts
│      ├── users.module.ts
│      ├── entities/
│      │   └── user.entity.ts
│      └── dto/
│         ├── create-user.dto.ts
│          └── update-user.dto.ts
│   
└── database/
    └── migrations/
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# Test coverage
npm run test:cov

# E2E tests
npm run test:e2e

# Watch mode
npm run test:watch
```

## 📋 Database Migrations

```bash
# Generate migration from entities
npm run migration:generate -- src/database/migrations/Initial

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

## 🔧 Code Quality

```bash
# Lint
npm run lint

# Format
npm run format
```

## 2026 Modern Best Practices Included

✅ **Modular Architecture** - Feature-based folder structure
✅ **Dependency Injection** - NestJS providers pattern
✅ **Type Safety** - Full TypeScript with strict mode
✅ **Validation Pipes** - Automatic DTO validation
✅ **Global Exception Handling** - Centralized error management
✅ **Authentication** - JWT with Passport
✅ **Database Optimization** - Indexes, relations management
✅ **Environment Config** - Secure configuration management
✅ **Docker Ready** - Multi-stage builds, optimization
✅ **Code Standards** - ESLint, Prettier, consistent style
✅ **API Documentation** - Clear endpoint descriptions
✅ **Pagination** - Scalable list endpoints
✅ **Query Optimization** - TypeORM query builder
✅ **Security** - Password hashing, JWT tokens

## 🐛 Troubleshooting

**Connection refused**
```bash
# Check PostgreSQL is running
docker-compose ps

# Restart services
docker-compose restart postgres
```

**Port already in use**
```bash
# Change port in .env
PORT=3001
```

**Module not found**
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

## 📝 License

MIT

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first.

## 📧 Support

For issues and questions, please create an issue in the repository.

---

**Built with ❤️ using NestJS, PostgreSQL, and TypeScript**

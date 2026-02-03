# 🚀 MetroProp Backend - Complete Setup Guide

## Project Successfully Created! ✅

Your modern NestJS PostgreSQL backend is ready to use. This document guides you through everything.

## 📁 Project Structure Created

```
metroprop_back/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # Root module with TypeORM
│   ├── app.controller.ts          # Root controller
│   ├── app.service.ts             # Root service
│   ├── common/
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts    # Global exception handling
│   │   └── guards/
│   │       └── jwt-auth.guard.ts           # JWT authentication guard
│   └── modules/
│       ├── auth/                          # Authentication module
│       │   ├── auth.service.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.module.ts
│       │   ├── strategies/
│       │   │   └── jwt.strategy.ts
│       │   └── dto/
│       │       └── login.dto.ts
│       ├── users/                         # User management
│       │   ├── users.service.ts
│       │   ├── users.controller.ts
│       │   ├── users.module.ts
│       │   ├── entities/
│       │   │   └── user.entity.ts
│       │   └── dto/
│       │       ├── create-user.dto.ts
│       │       └── update-user.dto.ts
│       └── properties/                    # Property listings
│           ├── properties.service.ts
│           ├── properties.controller.ts
│           ├── properties.module.ts
│           ├── entities/
│           │   └── property.entity.ts
│           └── dto/
│               ├── create-property.dto.ts
│               └── update-property.dto.ts
├── dist/                                  # Compiled JavaScript
├── node_modules/                          # Dependencies
├── package.json                           # Project dependencies
├── tsconfig.json                          # TypeScript configuration
├── jest.config.js                         # Testing configuration
├── Dockerfile                             # Docker configuration
├── docker-compose.yml                     # Multi-container setup
├── .env                                   # Environment variables (created)
├── .env.example                           # Environment template
├── .eslintrc.js                           # Linting rules
├── .prettierrc                            # Code formatting
├── README.md                              # Main documentation
├── QUICKSTART.md                          # Quick start guide
├── ARCHITECTURE.md                        # Architecture overview
└── SETUP.md                               # This file
```

## 🎯 Quick Start (5 Minutes)

### Step 1: Install Dependencies (Already Done ✓)
```bash
npm install --legacy-peer-deps
```

### Step 2: Verify Environment Configuration
Edit the `.env` file with your database credentials:
```env
NODE_ENV=development
PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=metroprop_db
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
```

### Step 3: Start PostgreSQL
```bash
# Option A: Using Docker (Recommended)
docker-compose up -d postgres

# Option B: Using local PostgreSQL
createdb metroprop_db
```

### Step 4: Start Development Server
```bash
npm run start:dev
```

Expected output:
```
[Nest] 12345 - 02/02/2026, 12:00:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345 - 02/02/2026, 12:00:01 AM     LOG [InstanceLoader] AppModule dependencies initialized +123ms
🚀 Application is running on: http://localhost:3000
```

### Step 5: Test the API
```bash
# Check if API is running
curl http://localhost:3000

# Response: Welcome to MetroProp Backend API!
```

## 📚 Available Commands

### Development
```bash
npm run start:dev      # Start with hot-reload
npm run start:debug    # Start with debugging
npm run start          # Start in production mode
```

### Building
```bash
npm run build          # Compile TypeScript
npm run build          # Production-ready build
```

### Production
```bash
npm run build
npm run start:prod
```

### Code Quality
```bash
npm run lint           # Check code style
npm run format         # Auto-format code
```

### Testing
```bash
npm run test           # Run all tests
npm run test:watch     # Watch mode
npm run test:cov       # Coverage report
npm run test:e2e       # End-to-end tests
```

### Database
```bash
npm run migration:create -- src/database/migrations/Initial
npm run migration:generate -- src/database/migrations/Initial
npm run migration:run       # Apply migrations
npm run migration:revert    # Rollback last migration
npm run seed                # Seed database with data
```

## 🔐 Authentication Workflow

### 1. Register a New User
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePassword123",
    "phone": "+1234567890"
  }'
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "isVerified": false,
  "createdAt": "2026-02-02T12:00:00Z",
  "updatedAt": "2026-02-02T12:00:00Z"
}
```

### 2. Login to Get Token
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePassword123"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

### 3. Use Token for Protected Endpoints
```bash
curl -X PATCH http://localhost:3000/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "phone": "+9876543210"
  }'
```

## 🏗️ Creating Properties (Example Use Case)

### 1. Create a Property (Requires JWT Token)
```bash
curl -X POST http://localhost:3000/properties \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Beautiful Apartment in Downtown",
    "description": "Modern 2-bedroom apartment with great amenities",
    "address": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "price": 2500000,
    "area": 1200,
    "bedrooms": 2,
    "bathrooms": 2,
    "propertyType": "apartment",
    "amenities": ["gym", "pool", "parking"],
    "images": ["https://example.com/photo1.jpg"],
    "latitude": 40.7128,
    "longitude": -74.0060
  }'
```

### 2. List All Properties
```bash
curl http://localhost:3000/properties?limit=10&offset=0

# With filters
curl http://localhost:3000/properties?city=New%20York&propertyType=apartment&status=available
```

### 3. Get Specific Property
```bash
curl http://localhost:3000/properties/550e8400-e29b-41d4-a716-446655440000
```

## 🐳 Docker Deployment

### Local Docker Compose (Recommended for Development)
```bash
# Start everything (app + postgres)
docker-compose up

# Or background mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Clean up volumes (reset database)
docker-compose down -v
```

### Build Docker Image Manually
```bash
docker build -t metroprop-api:1.0 .

docker run -p 3000:3000 \
  -e DATABASE_HOST=host.docker.internal \
  -e DATABASE_USER=postgres \
  -e DATABASE_PASSWORD=postgres \
  -e DATABASE_NAME=metroprop_db \
  metroprop-api:1.0
```

## 🔍 Monitoring & Debugging

### Health Check
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-02T12:00:00.000Z",
  "uptime": 123.456
}
```

### View Logs
```bash
# Development console (auto-showing)
npm run start:dev

# Application logs
tail -f logs/app.log

# Database logs
docker-compose logs postgres
```

### Debug Mode (VS Code)
```bash
npm run start:debug
# Click Debug Console button in VS Code or attach debugger
# Breakpoints work automatically
```

## 📊 Database Management

### Access PostgreSQL Shell
```bash
# If using Docker
docker-compose exec postgres psql -U postgres -d metroprop_db

# If local installation
psql -U postgres -d metroprop_db
```

### Useful SQL Commands
```sql
-- List all tables
\dt

-- List users
SELECT * FROM users;

-- List properties
SELECT * FROM properties;

-- Check indexes
\di

-- Exit
\q
```

### Reset Database
```bash
# Remove all data and start fresh
docker-compose down -v

# Or with psql
DROP DATABASE metroprop_db;
CREATE DATABASE metroprop_db;
```

## 🛠️ Troubleshooting

### Port 3000 Already in Use
```bash
# Find process using port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Or use different port in .env
PORT=3001
```

### PostgreSQL Connection Refused
```bash
# Check if postgres is running
docker-compose ps

# Restart postgres
docker-compose restart postgres

# View postgres logs
docker-compose logs postgres

# Check connection string
echo $DATABASE_HOST  # Should be: localhost
```

### Module Not Found Error
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Clear TypeScript cache
rm -rf dist/
npm run build
```

### Build Fails
```bash
# Check TypeScript errors
npx tsc --noEmit

# Fix ESLint issues
npm run lint -- --fix

# Try clean rebuild
npm run build -- --verbose
```

## 📈 Performance Tips

1. **Enable Database Query Logging** (Development Only)
   ```env
   DATABASE_LOGGING=true
   ```

2. **Optimize Queries**
   - Use pagination for large datasets
   - Add indexes on frequently searched fields
   - Use database views for complex queries

3. **Caching Strategy**
   - Add Redis for session management
   - Cache frequently accessed data
   - Use HTTP caching headers

4. **Load Testing**
   ```bash
   npm install -g ab
   ab -n 1000 -c 10 http://localhost:3000/health
   ```

## 🚀 Deployment Checklist

- [ ] Update JWT_SECRET in production environment
- [ ] Set NODE_ENV=production
- [ ] Use production database (cloud provider)
- [ ] Enable HTTPS/SSL
- [ ] Set up monitoring and logging
- [ ] Configure backups for database
- [ ] Set up CI/CD pipeline
- [ ] Configure rate limiting
- [ ] Enable CORS for your frontend domain
- [ ] Set up error tracking (Sentry)
- [ ] Configure load balancer
- [ ] Test health check endpoint
- [ ] Document API with Swagger
- [ ] Set up automated backups

## 📚 Recommended Next Steps

1. **API Documentation**
   ```bash
   npm install @nestjs/swagger swagger-ui-express
   ```

2. **Database Migrations**
   ```bash
   npm run migration:generate -- src/database/migrations/Initial
   npm run migration:run
   ```

3. **Caching Layer**
   ```bash
   npm install redis ioredis
   ```

4. **File Upload**
   ```bash
   npm install multer @types/multer
   ```

5. **Real-time Features**
   ```bash
   npm install @nestjs/websockets socket.io
   ```

6. **API Versioning**
   - Add version prefix to routes: `/v1/users`

7. **Logging & Monitoring**
   ```bash
   npm install winston pino
   ```

8. **Environment Manager**
   ```bash
   npm install joi
   ```

## 📞 Support & Resources

- **NestJS** - https://docs.nestjs.com
- **TypeORM** - https://typeorm.io
- **PostgreSQL** - https://www.postgresql.org/docs
- **JWT** - https://jwt.io
- **RESTful API Design** - https://restfulapi.net

## 📋 Key Files to Know

| File | Purpose |
|------|---------|
| `src/main.ts` | Application bootstrap |
| `src/app.module.ts` | Root module with TypeORM config |
| `.env` | Environment variables |
| `package.json` | Dependencies & scripts |
| `tsconfig.json` | TypeScript configuration |
| `docker-compose.yml` | Multi-container setup |
| `Dockerfile` | Docker image definition |

## 🎓 Learning Path

1. Read `README.md` - Project overview
2. Follow `QUICKSTART.md` - Get it running quickly  
3. Study `ARCHITECTURE.md` - Understand design
4. Read `SETUP.md` (this file) - Deep dive
5. Explore source code - Learn implementation
6. Create your own modules - Build features

## ✨ 2026 Best Practices Implemented

✅ Modular architecture with feature-based structure
✅ Dependency injection for testability
✅ Type safety with strict TypeScript
✅ Input validation with DTOs
✅ Exception handling at global level
✅ JWT authentication with Passport
✅ Password hashing with bcryptjs
✅ Database migrations support
✅ Docker & Docker Compose ready
✅ Environment-based configuration
✅ Pagination for scalability
✅ Code formatting with Prettier
✅ Linting with ESLint
✅ Testing framework configured
✅ Health check endpoints
✅ CORS support
✅ Security best practices

---

**Your modern NestJS backend is ready! 🎉**

Start with:
```bash
npm run start:dev
```

Then visit: `http://localhost:3000`

Happy coding! 🚀

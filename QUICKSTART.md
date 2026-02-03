# Quick Start Guide

## Installation & Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Start PostgreSQL (Docker)
```bash
docker-compose up -d postgres
# Wait for postgres service to be healthy (check docker-compose ps)
```

### 4. Start Development Server
```bash
npm run start:dev
```

The API runs at `http://localhost:3000`

## 2026 Modern Backend Best Practices

### ✨ Architecture Highlights

1. **Modular Feature Structure**
   - Each feature (users, auth, properties) is self-contained
   - Easy to add new modules independently

2. **Dependency Injection (NestJS Pattern)**
   - Clean, testable code
   - Loose coupling between modules

3. **Type Safety First**
   - Full TypeScript with strict mode enabled
   - DTOs for input validation

4. **API Best Practices**
   - RESTful endpoints
   - Proper HTTP status codes
   - Comprehensive error handling
   - Pagination support

5. **Security**
   - JWT authentication
   - Password hashing with bcrypt
   - Environment variable configuration
   - CORS support

6. **Database**
   - TypeORM for database abstraction
   - Migration support
   - Relationships and indexes
   - Transaction support ready

7. **Code Quality**
   - ESLint for static analysis
   - Prettier for formatting
   - Jest for testing
   - Pre-configured strict TypeScript

## File Structure Explained

```
src/
├── main.ts                      # Entry point, middleware setup
├── app.module.ts                # Root module with TypeORM config
├── common/
│   ├── filters/                 # Global exception handling
│   └── guards/                  # JWT authentication guard
├── modules/
│   ├── auth/                    # Authentication (JWT)
│   ├── users/                   # User management
│   └── properties/              # Property listings (real-world example)
└── database/
    └── migrations/              # Database migrations
```

## Testing the API

### 1. Create a User
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "Password123"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "Password123"
  }'
```

### 3. Use Token for Protected Routes
```bash
curl -X GET http://localhost:3000/users \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Development Workflow

### Development Mode with Auto-Reload
```bash
npm run start:dev
```

### Production Build
```bash
npm run build
npm run start:prod
```

### Run Tests
```bash
npm run test
npm run test:cov
```

### Code Linting & Formatting
```bash
npm run lint
npm run format
```

## Database Management

### View Logs
```bash
docker-compose logs -f postgres
```

### Access PostgreSQL Shell
```bash
docker-compose exec postgres psql -U postgres -d metroprop_db
```

### Reset Database
```bash
docker-compose down -v  # Remove volume
docker-compose up -d postgres
```

## Deployment Ready

This project is prepared for production with:
- Docker & Docker Compose configuration
- Multi-stage builds for optimized images
- Environment-based configuration
- Error handling and logging
- CORS support
- Health check endpoints

## Next Steps

1. Add more modules for your business logic
2. Implement database migrations
3. Add API documentation with Swagger
4. Set up CI/CD pipeline
5. Deploy to cloud (AWS, GCP, Azure, etc.)

## Troubleshooting

**Port 3000 already in use?**
```bash
# Change in .env
PORT=3001
```

**PostgreSQL connection failed?**
```bash
# Check if postgres is running
docker-compose ps

# View logs
docker-compose logs postgres
```

**Build fails?**
```bash
# Clear node_modules and reinstall
rm -r node_modules
npm install --legacy-peer-deps
npm run build
```

## Support & Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)
- [Passport.js JWT](http://www.passportjs.org/packages/passport-jwt/)

---

**Happy coding! 🚀**

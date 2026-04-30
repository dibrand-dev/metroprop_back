# Registro (registration)

## Endpoints

### POST /registration
- Descripción: Registro simple de usuario.
- Body ejemplo:
```json
{
  "name": "Juan Perez",
  "email": "juan@mail.com",
  "password": "12345678",
  "document": "30123456"
}
```

### POST /registration/professional
- Descripción: Registro profesional.
- Body ejemplo:
```json
{
  "name": "Profesional Ejemplo",
  "email": "pro@mail.com",
  "password": "12345678",
  "document": "30123456",
  "license": "1234-5678"
}
```

### POST /registration/google
- Descripción: Registro o login con Google.
- Body ejemplo:
```json
{
  "token": "token_google"
}
```

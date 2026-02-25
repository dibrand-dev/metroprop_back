# Usuarios (users)

## Endpoints

### GET /users
- Descripción: Listar todos los usuarios.
- Body: _No requiere body._

### GET /users/:id
- Descripción: Obtener usuario por ID.
- Body: _No requiere body._

### POST /users
- Descripción: Crear usuario.
- Body ejemplo:
```json
{
  "name": "Juan Perez",
  "email": "juan@mail.com",
  "password": "12345678",
  "google_id": "opcional",
  "phone": "+5491122334455"
}
```

### PATCH /users/:id
- Descripción: Actualizar usuario.
- Body ejemplo:
```json
{
  "name": "Nuevo Nombre",
  "email": "nuevo@mail.com",
  "password": "nuevaPassword",
  "branchIds": [1,2],
  "avatar": "url_avatar"
}
```

### DELETE /users/:id
- Descripción: Eliminar usuario.
- Body: _No requiere body._

### POST /users/:id/avatar
- Descripción: Subir avatar (form-data, campo: avatar).
- Body: _Archivo (form-data)_

### POST /users/verify-email
- Descripción: Verificar email con token.
- Body ejemplo:
```json
{
  "token": "token_de_verificacion"
}
```

### POST /users/request-password-reset
- Descripción: Solicitar recuperación de contraseña.
- Body ejemplo:
```json
{
  "email": "usuario@mail.com"
}
```

### POST /users/reset-password
- Descripción: Resetear contraseña.
- Body ejemplo:
```json
{
  "token": "token_recibido",
  "newPassword": "nuevaPassword"
}
```

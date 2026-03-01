# Locations API

## Endpoints

### GET /location/countries
- Descripción: Obtiene la lista de países (type = 'country').
- Respuesta ejemplo:
```json
[
  {
    "id": 1,
    "name": "Argentina",
    "iso_code": "AR",
    "type": "country",
    "parent_id": null
  },
  {
    "id": 2,
    "name": "Brasil",
    "iso_code": "BR",
    "type": "country",
    "parent_id": null
  }
]
```

### GET /location/getCountryStates?countryId=1
- Descripción: Obtiene los estados/provincias de un país (type = 'state', parent_id = countryId).
- Respuesta ejemplo:
```json
[
  {
    "id": 10,
    "name": "Buenos Aires",
    "type": "state",
    "parent_id": 1
  },
  {
    "id": 11,
    "name": "Córdoba",
    "type": "state",
    "parent_id": 1
  }
]
```

### GET /location/getStateLocations?stateId=10
- Descripción: Obtiene las localidades de un estado/provincia (type = 'location', parent_id = stateId).
- Respuesta ejemplo:
```json
[
  {
    "id": 100,
    "name": "La Plata",
    "type": "location",
    "parent_id": 10
  },
  {
    "id": 101,
    "name": "Mar del Plata",
    "type": "location",
    "parent_id": 10
  }
]
```

### GET /location/getLocationChildrens?locationId=100
- Descripción: Obtiene las localidades hijas de una location (parent_id = locationId). Puede devolver vacío si no hay hijos.
- Respuesta ejemplo:
```json
[]
```

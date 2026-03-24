### POST /partners/properties
- Descripción: Crear o actualizar (upsert) una propiedad para un partner. Ahora soporta imágenes y adjuntos directamente en el payload, además de videos, multimedia360 y tags.
- Body ejemplo:
```json
{
  "reference_code": "PROP-APT-2024-001",
  "branch_reference_id": 1,
  "publication_title": "Departamento Moderno en Centro",
  "property_type": 1,
  "status": 1,
  "images": [
    {
      "url": "https://www.imagen.com/123.webp",
      "description": "no obligatoria description"
    },
    {
      "url": "https://www.imagen.com/456.jpg"
    }
  ],
  "attached": [
    {
      "file_url": "https://www.pdffile.com/plano2.pdf"
    }
  ],
  "videos": [
    { "url": "https://video.com/1.mp4" }
  ],
  "multimedia360": [
    { "url": "https://360.com/1" }
  ],
  "tags": [1,2]
}
```
- Notas:
  - Las imágenes y adjuntos deben enviarse como arrays de objetos con al menos el campo `url`.
  - Ya no es necesario usar endpoints separados para imágenes y adjuntos al crear o actualizar una propiedad.
  - El campo `images[].description` es opcional.
  - El campo `attached[].description` es opcional.

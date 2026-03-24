import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PartnersModule } from '../modules/partners/partners.module';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('MetroProp Partner API')
    .setDescription(
      'API para integración de CRMs y partners externos. ' +
      'Permite crear organizaciones, gestionar propiedades, imágenes y adjuntos.',
    )
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', name: 'x-api-key', in: 'header', description: 'API Key del partner' },
      'x-api-key',
    )
    .addApiKey(
      { type: 'apiKey', name: 'x-api-secret', in: 'header', description: 'API Secret del partner' },
      'x-api-secret',
    )
    .addTag('Organizations', 'Crear organizaciones con sucursal y usuario administrador')
    .addTag('Properties', 'CRUD de propiedades inmobiliarias')
    .addTag('Locations', 'Países, provincias, localidades y sublocalidades')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    include: [PartnersModule],
  });

  // Remove the implicit 'PartnerApi' tag derived from the controller class name.
  // All endpoints use explicit per-method @ApiTags, so this tag only creates a duplicate group.
  for (const pathObj of Object.values(document.paths)) {
    for (const operation of Object.values(pathObj as object)) {
      if (Array.isArray((operation as any).tags)) {
        (operation as any).tags = (operation as any).tags.filter(
          (t: string) => t !== 'PartnerApi',
        );
      }
    }
  }
  if (Array.isArray(document.tags)) {
    document.tags = document.tags.filter((t) => t.name !== 'PartnerApi');
  }

  SwaggerModule.setup('api/partner/docs', app, document, {
    swaggerOptions: {
      defaultModelsExpandDepth: -1, // hides the Schemas section
    },
  });
}

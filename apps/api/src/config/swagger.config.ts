import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { INestApplication } from "@nestjs/common";

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("Surgical Medical Equipment Platform API")
    .setDescription("REST API for customer, admin, and delivery partner flows.")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true
    }
  });
}

require('dotenv').config();
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	const config = new DocumentBuilder()
		.setTitle('DefichainIndexer API')
		.setDescription('The API description')
		.setVersion('1.0.0')
		.addBearerAuth({
			type: 'apiKey',
			description: 'JWT Authorization via API',
			name: 'Authorization',
			in: 'header',
			scheme: 'bearer',
		})
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('swagger', app, document, {
		swaggerOptions: {
			persistAuthorization: true,
		},
	});

	await app.listen(process.env.PORT || 3000);
}
bootstrap();

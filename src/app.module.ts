import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueModule } from '@subrelay/nestjs-queue';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    QueueModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        producers: [
          {
            name: configService.get('QUEUE_NAME'),
            host: configService.get('REDIS_HOST'),
            password: configService.get('REDIS_PASSWORD'),
            port: parseInt(configService.get('REDIS_PORT')),
            queueUrl: configService.get('QUEUE_URL'),
          },
        ],
      }),
    }),
  ],
  providers: [AppService],
})
export class AppModule {}

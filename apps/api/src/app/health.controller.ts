import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  /** Utilisé par le healthcheck Docker et Uptime Kuma : vérifie aussi que la base répond. */
  @Get()
  async check(): Promise<{ status: 'ok' }> {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok' };
  }
}

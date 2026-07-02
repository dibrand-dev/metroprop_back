import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AppLoggerService {
  private readonly logsDir = path.join(process.cwd(), 'logs');

  private ensureLogsDir(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private write(file: string, level: string, msg: string): void {
    this.ensureLogsDir();
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${level} ${msg}\n`;
    fs.appendFileSync(path.join(this.logsDir, file), line, 'utf8');
  }

  log(file: string, msg: string): void {
    this.write(file, 'INFO', msg);
  }

  warn(file: string, msg: string): void {
    this.write(file, 'WARN', msg);
  }

  error(file: string, msg: string, err?: unknown): void {
    const detail = err instanceof Error ? err.stack || err.message : String(err ?? '');
    this.write(file, 'ERROR', `${msg} ${detail}`);
    this.write('errors.log', 'ERROR', `${msg} ${detail}`);
  }
}

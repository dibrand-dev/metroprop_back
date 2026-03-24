import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * LoggerService: file-based logger for general errors and warnings.
 *
 * Logs to:
 *   logs/general-YYYY-MM-DD.log — info, warn, error
 *   logs/errors-YYYY-MM-DD.log  — only errors
 */
@Injectable()
export class LoggerService {
  private readonly logsDir = path.join(process.cwd(), 'logs');

  private get dateStamp(): string {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private get generalLogPath(): string {
    return path.join(this.logsDir, `general-${this.dateStamp}.log`);
  }

  private get errorLogPath(): string {
    return path.join(this.logsDir, `errors-${this.dateStamp}.log`);
  }

  private ensureLogsDir(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private write(filePath: string, line: string): void {
    try {
      this.ensureLogsDir();
      const timestamp = new Date().toISOString();
      const entry = `[${timestamp}] ${line}\n`;
      fs.appendFileSync(filePath, entry, 'utf8');
    } catch (err) {
      // Fallback to stdout so errors are never lost
      console.error(`[LoggerService] Failed to write log to ${filePath}: ${(err as Error).message}`);
      console.error(`[LoggerService] Log entry: ${line}`);
    }
  }

  info(msg: string): void {
    this.write(this.generalLogPath, `INFO  ${msg}`);
  }

  warn(msg: string): void {
    this.write(this.generalLogPath, `WARN  ${msg}`);
  }

  error(msg: string, err?: unknown): void {
    const detail = err instanceof Error
      ? `${err.message}${err.stack ? `\n       Stack: ${err.stack.split('\n').slice(0, 4).join(' | ')}` : ''}`
      : err != null ? String(err) : '';
    const line = detail ? `${msg} — ${detail}` : msg;
    this.write(this.generalLogPath, `ERROR ${line}`);
    this.write(this.errorLogPath, `ERROR ${line}`);
  }
}

import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { LoggerService } from '@nestjs/common';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';

export class FileLogger implements LoggerService {
  private readonly logRoot = resolve(process.cwd(), 'logs');

  log(message: unknown, context?: string) {
    this.write('log', message, context);
  }

  error(message: unknown, stack?: string, context?: string) {
    this.write('error', message, context, stack);
  }

  warn(message: unknown, context?: string) {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string) {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string) {
    this.write('verbose', message, context);
  }

  fatal(message: unknown, context?: string) {
    this.write('fatal', message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, stack?: string) {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const directory = resolve(this.logRoot, date);
    mkdirSync(directory, { recursive: true });

    const entry = {
      timestamp: now.toISOString(),
      level,
      context: context ?? null,
      message: this.stringify(message),
      ...(stack ? { stack } : {}),
    };
    const line = `${JSON.stringify(entry)}\n`;

    appendFileSync(resolve(directory, 'app.log'), line, 'utf8');
    if (level === 'error' || level === 'fatal') {
      appendFileSync(resolve(directory, 'error.log'), line, 'utf8');
    }

    const consoleMessage = `[${level.toUpperCase()}]${context ? ` [${context}]` : ''} ${entry.message}`;
    if (level === 'error' || level === 'fatal') {
      console.error(consoleMessage, stack ?? '');
    } else if (level === 'warn') {
      console.warn(consoleMessage);
    } else {
      console.log(consoleMessage);
    }
  }

  private stringify(message: unknown): string {
    if (message instanceof Error) return message.message;
    if (typeof message === 'string') return message;
    try { return JSON.stringify(message); } catch { return String(message); }
  }
}

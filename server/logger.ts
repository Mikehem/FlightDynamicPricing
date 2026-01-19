type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const colors = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  reset: '\x1b[0m',
};

class Logger {
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: LogLevel, context: string, message: string, data?: unknown): string {
    const timestamp = this.formatTimestamp();
    const color = colors[level];
    const prefix = `${color}[${level.toUpperCase()}]${colors.reset}`;
    const contextStr = context ? `[${context}]` : '';
    
    let output = `${timestamp} ${prefix} ${contextStr} ${message}`;
    if (data !== undefined) {
      try {
        output += ` ${JSON.stringify(data, null, 0)}`;
      } catch {
        output += ` [Unstringifiable data]`;
      }
    }
    return output;
  }

  debug(context: string, message: string, data?: unknown) {
    console.debug(this.formatMessage('debug', context, message, data));
  }

  info(context: string, message: string, data?: unknown) {
    console.info(this.formatMessage('info', context, message, data));
  }

  warn(context: string, message: string, data?: unknown) {
    console.warn(this.formatMessage('warn', context, message, data));
  }

  error(context: string, message: string, error?: unknown) {
    const errorData = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;
    console.error(this.formatMessage('error', context, message, errorData));
  }

  api(method: string, path: string, status: number, durationMs: number, error?: string) {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const message = `${method} ${path} ${status} in ${durationMs}ms`;
    if (error) {
      this[level]('API', message, { error });
    } else {
      this[level]('API', message);
    }
  }

  agent(agentName: string, action: string, details?: unknown) {
    this.info('Agent', `[${agentName}] ${action}`, details);
  }

  orchestration(phase: string, message: string, data?: unknown) {
    this.info('Orchestration', `[${phase}] ${message}`, data);
  }
}

export const logger = new Logger();

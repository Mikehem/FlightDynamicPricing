type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class FrontendLogger {
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: LogLevel, context: string, message: string): string {
    const timestamp = this.formatTimestamp();
    return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;
  }

  debug(context: string, message: string, data?: unknown) {
    console.debug(this.formatMessage('debug', context, message), data ?? '');
  }

  info(context: string, message: string, data?: unknown) {
    console.info(this.formatMessage('info', context, message), data ?? '');
  }

  warn(context: string, message: string, data?: unknown) {
    console.warn(this.formatMessage('warn', context, message), data ?? '');
  }

  error(context: string, message: string, error?: unknown) {
    const errorData = error instanceof Error 
      ? { message: error.message, stack: error.stack, name: error.name }
      : error;
    console.error(this.formatMessage('error', context, message), errorData ?? '');
  }

  api(method: string, path: string, status?: number, error?: string) {
    if (error || (status && status >= 400)) {
      this.error('API', `${method} ${path} failed`, { status, error });
    } else {
      this.debug('API', `${method} ${path} ${status ?? 'pending'}`);
    }
  }

  component(componentName: string, action: string, data?: unknown) {
    this.debug('Component', `[${componentName}] ${action}`, data);
  }

  userAction(action: string, details?: unknown) {
    this.info('UserAction', action, details);
  }
}

export const logger = new FrontendLogger();

// Global error handler for unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Global', 'Unhandled promise rejection', event.reason);
  });

  window.addEventListener('error', (event) => {
    logger.error('Global', 'Uncaught error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
}

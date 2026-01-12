type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Structured logger for the application
 * Uses JSON format for easy parsing in production
 */
class Logger {
  private readonly minLevel: LogLevel;
  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(minLevel: LogLevel = "info") {
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.minLevel];
  }

  private formatError(error: unknown): LogEntry["error"] | undefined {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    if (error) {
      return {
        name: "UnknownError",
        message: String(error),
      };
    }
    return undefined;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: unknown): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }
    if (error) {
      entry.error = this.formatError(error);
    }

    // In development, use console methods with colors
    // In production, output JSON for structured logging
    const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";

    if (isDev) {
      const colors: Record<LogLevel, string> = {
        debug: "\x1b[36m", // Cyan
        info: "\x1b[32m", // Green
        warn: "\x1b[33m", // Yellow
        error: "\x1b[31m", // Red
      };
      const reset = "\x1b[0m";
      const prefix = `${colors[level]}[${level.toUpperCase()}]${reset}`;

      const consoleMethod = level === "debug" ? "log" : level;
      const args: unknown[] = [`${prefix} ${message}`];
      if (context && Object.keys(context).length > 0) args.push(context);
      if (error) args.push(error);
      // eslint-disable-next-line no-console
      console[consoleMethod](...args);
    } else {
      // Production: JSON output
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(entry));
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext, error?: unknown): void {
    this.log("warn", message, context, error);
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    this.log("error", message, context, error);
  }

  /**
   * Create a child logger with additional context
   */
  child(baseContext: LogContext): ChildLogger {
    return new ChildLogger(this, baseContext);
  }
}

class ChildLogger {
  constructor(
    private readonly parent: Logger,
    private readonly baseContext: LogContext
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.baseContext, ...context };
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext, error?: unknown): void {
    this.parent.warn(message, this.mergeContext(context), error);
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    this.parent.error(message, error, this.mergeContext(context));
  }

  child(additionalContext: LogContext): ChildLogger {
    return new ChildLogger(this.parent, this.mergeContext(additionalContext));
  }
}

// Default logger instance
const logLevel = (typeof process !== "undefined" && process.env?.LOG_LEVEL as LogLevel) || "info";
export const logger = new Logger(logLevel);

// Export types
export type { LogLevel, LogContext, LogEntry };
export { Logger, ChildLogger };

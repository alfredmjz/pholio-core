/**
 * Centralized Logger using Pino
 *
 * High-performance structured logging for the Pholio application.
 * Provides consistent log format with support for:
 * - Log levels: debug, info, warn, error
 * - Structured context objects
 * - HTTP request/response logging
 * - Status codes and error messages
 *
 * @example
 * ```typescript
 * import { logger } from '@/lib/logger';
 *
 * // Simple logging
 * logger.info('User logged in');
 * logger.warn('Rate limit approaching');
 * logger.error('Database connection failed');
 *
 * // With context
 * logger.info({ userId: '123', action: 'login' }, 'User logged in');
 * logger.error({ statusCode: 500, error: err }, 'Request failed');
 *
 * // HTTP logging helper
 * logRequest(request, 'Incoming request');
 * logResponse(response, { statusCode: 200 }, 'Request completed');
 * ```
 */

import pino from "pino";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Base Pino logger instance
 * - Uses standard JSON output (pino-pretty cannot be imported due to node:stream incompatibility with Edge/webpack)
 */
export const logger = pino({
	level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
	base: {
		env: process.env.NODE_ENV,
	},
	timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Log context type for structured logging
 */
export interface LogContext {
	statusCode?: number;
	error?: Error | unknown;
	userId?: string;
	endpoint?: string;
	requestId?: string;
	duration?: number;
	method?: string;
	path?: string;
	[key: string]: unknown;
}

/**
 * Logger class wrapper for more intuitive API
 * Matches the requested format: LOGGER.info/warn/error(message, context?)
 */
export const Logger = {
	/**
	 * Log debug level message (only in development)
	 */
	debug(message: string, context?: LogContext) {
		if (context) {
			logger.debug(context, message);
		} else {
			logger.debug(message);
		}
	},

	/**
	 * Log info level message
	 */
	info(message: string, context?: LogContext) {
		if (context) {
			logger.info(context, message);
		} else {
			logger.info(message);
		}
	},

	/**
	 * Log warning level message
	 */
	warn(message: string, context?: LogContext) {
		if (context) {
			logger.warn(context, message);
		} else {
			logger.warn(message);
		}
	},

	/**
	 * Log error level message
	 */
	error(message: string, context?: LogContext) {
		if (context) {
			// Serialize error if present
			const serializedContext = { ...context };
			if (context.error instanceof Error) {
				serializedContext.error = {
					name: context.error.name,
					message: context.error.message,
					stack: context.error.stack,
				};
			}
			logger.error(serializedContext, message);
		} else {
			logger.error(message);
		}
	},
};

/**
 * Log an incoming HTTP request
 */
export function logRequest(request: Request, message?: string) {
	const url = new URL(request.url);
	logger.info(
		{
			method: request.method,
			path: url.pathname,
			query: url.search || undefined,
		},
		message || "Incoming request"
	);
}

/**
 * Log an HTTP response
 */
export function logResponse(statusCode: number, context?: LogContext, message?: string) {
	const logContext: LogContext = {
		statusCode,
		...context,
	};

	if (statusCode >= 500) {
		logger.error(logContext, message || "Response error");
	} else if (statusCode >= 400) {
		logger.warn(logContext, message || "Response warning");
	} else {
		logger.info(logContext, message || "Response success");
	}
}

/**
 * Create a child logger with bound context
 * Useful for request-scoped logging
 */
export function createChildLogger(context: LogContext) {
	return logger.child(context);
}

// Default export for simple import
export default Logger;

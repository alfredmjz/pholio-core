/**
 * Error Handling System
 *
 * Provides standardized error handling for API routes with:
 * - Custom error classes with status codes
 * - Consistent error response format
 * - Error logging
 * - Type safety
 */

import { NextResponse } from 'next/server';

/**
 * Standard error response format
 */
export interface ErrorResponse {
	error: {
		message: string;
		code: string;
		statusCode: number;
		details?: Record<string, unknown>;
		timestamp: string;
	};
}

/**
 * Base custom error class
 */
export class AppError extends Error {
	public readonly statusCode: number;
	public readonly code: string;
	public readonly details?: Record<string, unknown>;
	public readonly isOperational: boolean;

	constructor(
		message: string,
		statusCode: number = 500,
		code: string = 'INTERNAL_ERROR',
		details?: Record<string, unknown>,
		isOperational: boolean = true
	) {
		super(message);
		Object.setPrototypeOf(this, AppError.prototype);

		this.statusCode = statusCode;
		this.code = code;
		this.details = details;
		this.isOperational = isOperational;

		Error.captureStackTrace(this, this.constructor);
	}
}

/**
 * 400 Bad Request - Client sent invalid data
 */
export class BadRequestError extends AppError {
	constructor(message: string = 'Bad request', details?: Record<string, unknown>) {
		super(message, 400, 'BAD_REQUEST', details);
		Object.setPrototypeOf(this, BadRequestError.prototype);
	}
}

/**
 * 401 Unauthorized - User not authenticated
 */
export class UnauthorizedError extends AppError {
	constructor(message: string = 'Unauthorized', details?: Record<string, unknown>) {
		super(message, 401, 'UNAUTHORIZED', details);
		Object.setPrototypeOf(this, UnauthorizedError.prototype);
	}
}

/**
 * 403 Forbidden - User doesn't have permission
 */
export class ForbiddenError extends AppError {
	constructor(message: string = 'Forbidden', details?: Record<string, unknown>) {
		super(message, 403, 'FORBIDDEN', details);
		Object.setPrototypeOf(this, ForbiddenError.prototype);
	}
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends AppError {
	constructor(message: string = 'Resource not found', details?: Record<string, unknown>) {
		super(message, 404, 'NOT_FOUND', details);
		Object.setPrototypeOf(this, NotFoundError.prototype);
	}
}

/**
 * 409 Conflict - Resource already exists or state conflict
 */
export class ConflictError extends AppError {
	constructor(message: string = 'Conflict', details?: Record<string, unknown>) {
		super(message, 409, 'CONFLICT', details);
		Object.setPrototypeOf(this, ConflictError.prototype);
	}
}

/**
 * 422 Unprocessable Entity - Validation failed
 */
export class ValidationError extends AppError {
	constructor(message: string = 'Validation failed', details?: Record<string, unknown>) {
		super(message, 422, 'VALIDATION_ERROR', details);
		Object.setPrototypeOf(this, ValidationError.prototype);
	}
}

/**
 * 500 Internal Server Error - Unexpected server error
 */
export class InternalServerError extends AppError {
	constructor(message: string = 'Internal server error', details?: Record<string, unknown>) {
		super(message, 500, 'INTERNAL_ERROR', details, false);
		Object.setPrototypeOf(this, InternalServerError.prototype);
	}
}

/**
 * 503 Service Unavailable - External service is down
 */
export class ServiceUnavailableError extends AppError {
	constructor(message: string = 'Service unavailable', details?: Record<string, unknown>) {
		super(message, 503, 'SERVICE_UNAVAILABLE', details);
		Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
	}
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
	error: Error | AppError,
	includeStack: boolean = process.env.NODE_ENV === 'development'
): ErrorResponse {
	const isAppError = error instanceof AppError;

	const errorResponse: ErrorResponse = {
		error: {
			message: isAppError ? error.message : 'An unexpected error occurred',
			code: isAppError ? error.code : 'INTERNAL_ERROR',
			statusCode: isAppError ? error.statusCode : 500,
			details: isAppError ? error.details : undefined,
			timestamp: new Date().toISOString(),
		},
	};

	// Add stack trace in development
	if (includeStack && error.stack) {
		(errorResponse.error as any).stack = error.stack;
	}

	return errorResponse;
}

/**
 * Log error with context
 */
export function logError(
	error: Error | AppError,
	context?: {
		endpoint?: string;
		userId?: string;
		requestId?: string;
		metadata?: Record<string, unknown>;
	}
) {
	const isAppError = error instanceof AppError;
	const isOperational = isAppError ? error.isOperational : false;

	const logData = {
		timestamp: new Date().toISOString(),
		message: error.message,
		code: isAppError ? error.code : 'UNKNOWN_ERROR',
		statusCode: isAppError ? error.statusCode : 500,
		isOperational,
		stack: error.stack,
		...context,
	};

	// Use console.error for non-operational errors (bugs)
	// Use console.warn for operational errors (expected issues)
	if (isOperational) {
		console.warn('Operational Error:', JSON.stringify(logData, null, 2));
	} else {
		console.error('Non-Operational Error (Bug):', JSON.stringify(logData, null, 2));
	}
}

/**
 * Main error handler for API routes
 *
 * @example
 * ```typescript
 * export async function POST(request: Request) {
 *   try {
 *     // Your logic here
 *     if (!data) {
 *       throw new BadRequestError('Data is required');
 *     }
 *     return NextResponse.json({ success: true });
 *   } catch (error) {
 *     return handleApiError(error, { endpoint: '/api/auth/signup' });
 *   }
 * }
 * ```
 */
export function handleApiError(
	error: unknown,
	context?: {
		endpoint?: string;
		userId?: string;
		requestId?: string;
		metadata?: Record<string, unknown>;
	}
): NextResponse<ErrorResponse> {
	// Convert unknown error to Error instance
	const errorInstance = error instanceof Error ? error : new Error(String(error));

	// Log the error
	logError(errorInstance, context);

	// Create standardized response
	const errorResponse = createErrorResponse(errorInstance);

	// Return NextResponse with appropriate status code
	return NextResponse.json(errorResponse, {
		status: errorResponse.error.statusCode,
	});
}

/**
 * Validation helper - throws ValidationError if condition is false
 *
 * @example
 * ```typescript
 * validate(email, 'Email is required');
 * validate(password.length >= 6, 'Password must be at least 6 characters', {
 *   minLength: 6,
 *   actualLength: password.length
 * });
 * ```
 */
export function validate(
	condition: unknown,
	message: string,
	details?: Record<string, unknown>
): asserts condition {
	if (!condition) {
		throw new ValidationError(message, details);
	}
}

/**
 * Async wrapper for API handlers with automatic error handling
 *
 * @example
 * ```typescript
 * export const POST = asyncHandler(async (request: Request) => {
 *   const body = await request.json();
 *   validate(body.email, 'Email is required');
 *
 *   // Your logic here
 *
 *   return NextResponse.json({ success: true });
 * }, { endpoint: '/api/auth/signup' });
 * ```
 */
export function asyncHandler(
	handler: (request: Request, context?: any) => Promise<NextResponse>,
	errorContext?: {
		endpoint?: string;
		userId?: string;
		requestId?: string;
	}
) {
	return async (request: Request, context?: any) => {
		try {
			return await handler(request, context);
		} catch (error) {
			return handleApiError(error, errorContext);
		}
	};
}

/**
 * Parse Supabase error and convert to appropriate AppError
 */
export function parseSupabaseError(error: any): AppError {
	const message = error?.message || 'Database error';
	const code = error?.code;

	// PostgreSQL error codes
	switch (code) {
		case '23505': // unique_violation
			return new ConflictError('Resource already exists', { code, originalMessage: message });
		case '23503': // foreign_key_violation
			return new BadRequestError('Invalid reference', { code, originalMessage: message });
		case '23514': // check_violation
			return new ValidationError('Data validation failed', { code, originalMessage: message });
		case '42501': // insufficient_privilege
			return new ForbiddenError('Insufficient permissions', { code, originalMessage: message });
		case 'PGRST116': // not found
			return new NotFoundError('Resource not found', { code, originalMessage: message });
		default:
			return new InternalServerError(message, { code, originalMessage: message });
	}
}

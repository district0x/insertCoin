import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

/**
 * Validation middleware that applies Zod schemas to request data
 * @param schema - Zod schema to validate against
 * @param data - Data to validate (body, query params, etc.)
 * @returns Validation result with success/error information
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): {
    success: true;
    data: T;
} | {
    success: false;
    error: string;
    details?: string[];
} {
    try {
        const validatedData = schema.parse(data);
        return { success: true, data: validatedData };
    } catch (error) {
        if (error instanceof ZodError) {
            const details = error.errors.map(err =>
                `${err.path.join('.')}: ${err.message}`
            );
            return {
                success: false,
                error: 'Validation failed',
                details
            };
        }
        return {
            success: false,
            error: 'Unknown validation error'
        };
    }
}

/**
 * Safe validation that doesn't throw errors
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result
 */
export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): {
    success: true;
    data: T;
} | {
    success: false;
    error: string;
} {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    } else {
        return {
            success: false,
            error: 'Validation failed'
        };
    }
}

/**
 * Validate request body with proper error handling
 * @param request - Next.js request object
 * @param schema - Zod schema for body validation
 * @returns Validation result or error response
 */
export async function validateRequestBody<T>(
    request: NextRequest,
    schema: z.ZodSchema<T>
): Promise<{
    success: true;
    data: T;
} | {
    success: false;
    response: NextResponse;
}> {
    try {
        const body = await request.json();
        const validation = validateData(schema, body);

        if (validation.success) {
            return { success: true, data: validation.data };
        } else {
            return {
                success: false,
                response: NextResponse.json(
                    {
                        error: 'Invalid request data',
                        message: validation.error,
                        details: validation.details
                    },
                    { status: 400 }
                )
            };
        }
    } catch (error) {
        return {
            success: false,
            response: NextResponse.json(
                {
                    error: 'Invalid JSON in request body',
                    message: 'Request body must be valid JSON'
                },
                { status: 400 }
            )
        };
    }
}

/**
 * Validate query parameters with proper error handling
 * @param request - Next.js request object
 * @param schema - Zod schema for query validation
 * @returns Validation result or error response
 */
export function validateQueryParams<T>(
    request: NextRequest,
    schema: z.ZodSchema<T>
): {
    success: true;
    data: T;
} | {
    success: false;
    response: NextResponse;
} {
    const url = new URL(request.url);
    const queryParams: Record<string, string> = {};

    // Extract all query parameters
    for (const [key, value] of url.searchParams.entries()) {
        queryParams[key] = value;
    }

    const validation = validateData(schema, queryParams);

    if (validation.success) {
        return { success: true, data: validation.data };
    } else {
        return {
            success: false,
            response: NextResponse.json(
                {
                    error: 'Invalid query parameters',
                    message: validation.error,
                    details: validation.details
                },
                { status: 400 }
            )
        };
    }
}

/**
 * Validate path parameters with proper error handling
 * @param params - Path parameters object
 * @param schema - Zod schema for params validation
 * @returns Validation result or error response
 */
export function validatePathParams<T>(
    params: Record<string, string>,
    schema: z.ZodSchema<T>
): {
    success: true;
    data: T;
} | {
    success: false;
    response: NextResponse;
} {
    const validation = validateData(schema, params);

    if (validation.success) {
        return { success: true, data: validation.data };
    } else {
        return {
            success: false,
            response: NextResponse.json(
                {
                    error: 'Invalid path parameters',
                    message: validation.error,
                    details: validation.details
                },
                { status: 400 }
            )
        };
    }
}

/**
 * Create a validation wrapper for API routes
 * @param schema - Zod schema for validation
 * @returns Function that validates request data
 */
export function createValidator<T>(schema: z.ZodSchema<T>) {
    return {
        validateBody: (request: NextRequest) => validateRequestBody(request, schema),
        validateQuery: (request: NextRequest) => validateQueryParams(request, schema),
        validateParams: (params: Record<string, string>) => validatePathParams(params, schema)
    };
}

/**
 * Sanitize and validate input data
 * @param data - Raw input data
 * @param schema - Zod schema for validation
 * @returns Sanitized and validated data
 */
export function sanitizeAndValidate<T>(data: unknown, schema: z.ZodSchema<T>): T {
    // Basic sanitization - remove null/undefined values and trim strings
    const sanitized = JSON.parse(JSON.stringify(data), (key, value) => {
        if (typeof value === 'string') {
            return value.trim();
        }
        return value;
    });

    return schema.parse(sanitized);
} 
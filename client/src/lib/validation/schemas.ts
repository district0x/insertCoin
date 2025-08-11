import { z } from 'zod';

// Wallet address validation (Ethereum format)
export const walletAddressSchema = z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address format')
    .min(42, 'Wallet address must be 42 characters')
    .max(42, 'Wallet address must be 42 characters');

// Match ID validation
export const matchIdSchema = z.number()
    .int('Match ID must be an integer')
    .positive('Match ID must be positive');

// User stats query validation
export const userStatsQuerySchema = z.object({
    address: walletAddressSchema
});

// Match completion validation
export const matchCompletionSchema = z.object({
    matchId: matchIdSchema,
    winnerAddress: walletAddressSchema
});

// Match sync validation
export const matchSyncSchema = z.object({
    matchId: matchIdSchema,
    walletAddress: walletAddressSchema
});

// Tournament participant validation
export const tournamentParticipantSchema = z.object({
    tournamentId: z.string().uuid('Invalid tournament ID'),
    walletAddress: walletAddressSchema
});

// Tournament status update validation
export const tournamentStatusSchema = z.object({
    tournamentId: z.string().uuid('Invalid tournament ID'),
    status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
});

// Tournament prize validation
export const tournamentPrizeSchema = z.object({
    tournamentId: z.string().uuid('Invalid tournament ID'),
    prizeAmount: z.number().positive('Prize amount must be positive'),
    tokenAddress: walletAddressSchema.optional()
});

// Discord linking validation
export const discordLinkSchema = z.object({
    discordId: z.string().min(17, 'Invalid Discord ID').max(20, 'Invalid Discord ID'),
    walletAddress: walletAddressSchema
});

// Rate limit configuration validation
export const rateLimitConfigSchema = z.object({
    windowMs: z.number().min(1000, 'Window must be at least 1 second').max(3600000, 'Window must be at most 1 hour'),
    maxRequests: z.number().min(1, 'Max requests must be at least 1').max(10000, 'Max requests must be at most 10000')
});

// API key validation (if needed for admin routes)
export const apiKeySchema = z.object({
    apiKey: z.string().min(32, 'API key must be at least 32 characters')
});

// Search parameters validation
export const searchParamsSchema = z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 10),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

// Generic ID validation
export const idParamSchema = z.object({
    id: z.string().uuid('Invalid ID format')
});

// Pagination validation
export const paginationSchema = z.object({
    page: z.number().int().min(1, 'Page must be at least 1').default(1),
    limit: z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit must be at most 100').default(10)
});

// Date range validation
export const dateRangeSchema = z.object({
    startDate: z.string().datetime('Invalid start date').optional(),
    endDate: z.string().datetime('Invalid end date').optional()
}).refine(data => {
    if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
}, {
    message: 'Start date must be before or equal to end date'
});

// Export all schemas
export const schemas = {
    walletAddress: walletAddressSchema,
    matchId: matchIdSchema,
    userStatsQuery: userStatsQuerySchema,
    matchCompletion: matchCompletionSchema,
    matchSync: matchSyncSchema,
    tournamentParticipant: tournamentParticipantSchema,
    tournamentStatus: tournamentStatusSchema,
    tournamentPrize: tournamentPrizeSchema,
    discordLink: discordLinkSchema,
    rateLimitConfig: rateLimitConfigSchema,
    apiKey: apiKeySchema,
    searchParams: searchParamsSchema,
    idParam: idParamSchema,
    pagination: paginationSchema,
    dateRange: dateRangeSchema
}; 
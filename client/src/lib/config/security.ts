/**
 * Security Configuration
 * Centralized security settings for the application
 */

export interface SecurityConfig {
    // Rate Limiting
    rateLimit: {
        enabled: boolean;
        windowMs: number;
        maxRequests: number;
        blockDurationMs: number;
        enableLogging: boolean;
        enableMetrics: boolean;
    };

    // CORS
    cors: {
        enabled: boolean;
        allowedOrigins: string[];
        allowedMethods: string[];
        allowedHeaders: string[];
        allowCredentials: boolean;
        maxAge: number;
    };

    // Security Headers
    headers: {
        enabled: boolean;
        strictTransportSecurity: boolean;
        contentSecurityPolicy: boolean;
        xFrameOptions: boolean;
        xContentTypeOptions: boolean;
        xXSSProtection: boolean;
        referrerPolicy: boolean;
        permissionsPolicy: boolean;
    };

    // Input Validation
    validation: {
        enabled: boolean;
        maxBodySize: number;
        maxQueryParams: number;
        sanitizeInputs: boolean;
        strictMode: boolean;
    };

    // Environment
    environment: {
        isProduction: boolean;
        isDevelopment: boolean;
        isTest: boolean;
        debugMode: boolean;
    };

    // Monitoring
    monitoring: {
        enabled: boolean;
        logSecurityEvents: boolean;
        trackRateLimitViolations: boolean;
        alertOnSuspiciousActivity: boolean;
    };
}

/**
 * Default security configuration
 */
const defaultConfig: SecurityConfig = {
    rateLimit: {
        enabled: true,
        windowMs: 60000, // 1 minute
        maxRequests: 100,
        blockDurationMs: 300000, // 5 minutes
        enableLogging: false,
        enableMetrics: true
    },

    cors: {
        enabled: true,
        allowedOrigins: ['http://localhost:3000', 'https://localhost:3000'],
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        allowCredentials: true,
        maxAge: 86400 // 24 hours
    },

    headers: {
        enabled: true,
        strictTransportSecurity: true,
        contentSecurityPolicy: true,
        xFrameOptions: true,
        xContentTypeOptions: true,
        xXSSProtection: true,
        referrerPolicy: true,
        permissionsPolicy: true
    },

    validation: {
        enabled: true,
        maxBodySize: 1024 * 1024, // 1MB
        maxQueryParams: 50,
        sanitizeInputs: true,
        strictMode: false
    },

    environment: {
        isProduction: process.env.NODE_ENV === 'production',
        isDevelopment: process.env.NODE_ENV === 'development',
        isTest: process.env.NODE_ENV === 'test',
        debugMode: process.env.NODE_ENV === 'development'
    },

    monitoring: {
        enabled: true,
        logSecurityEvents: true,
        trackRateLimitViolations: true,
        alertOnSuspiciousActivity: process.env.NODE_ENV === 'production'
    }
};

/**
 * Production security configuration
 */
const productionConfig: Partial<SecurityConfig> = {
    rateLimit: {
        enabled: true,
        windowMs: 60000,
        maxRequests: 100,
        blockDurationMs: 600000, // 10 minutes
        enableLogging: false,
        enableMetrics: true
    },

    cors: {
        enabled: true,
        allowedOrigins: [
            'https://yourdomain.com', // Replace with your actual domain
            'https://www.yourdomain.com'
        ],
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        allowCredentials: true,
        maxAge: 86400
    },

    headers: {
        enabled: true,
        strictTransportSecurity: true,
        contentSecurityPolicy: true,
        xFrameOptions: true,
        xContentTypeOptions: true,
        xXSSProtection: true,
        referrerPolicy: true,
        permissionsPolicy: true
    },

    validation: {
        enabled: true,
        maxBodySize: 1024 * 1024, // 1MB
        maxQueryParams: 50,
        sanitizeInputs: true,
        strictMode: true
    },

    monitoring: {
        enabled: true,
        logSecurityEvents: true,
        trackRateLimitViolations: true,
        alertOnSuspiciousActivity: true
    }
};

/**
 * Development security configuration
 */
const developmentConfig: Partial<SecurityConfig> = {
    rateLimit: {
        enabled: true,
        windowMs: 60000,
        maxRequests: 1000, // More lenient in development
        blockDurationMs: 60000, // 1 minute
        enableLogging: true,
        enableMetrics: true
    },

    cors: {
        enabled: true,
        allowedOrigins: ['*'], // More permissive in development
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['*'],
        allowCredentials: true,
        maxAge: 86400
    },

    headers: {
        enabled: true,
        strictTransportSecurity: false, // Disabled for local development
        contentSecurityPolicy: true,
        xFrameOptions: true,
        xContentTypeOptions: true,
        xXSSProtection: true,
        referrerPolicy: true,
        permissionsPolicy: true
    },

    validation: {
        enabled: true,
        maxBodySize: 10 * 1024 * 1024, // 10MB in development
        maxQueryParams: 100,
        sanitizeInputs: true,
        strictMode: false
    },

    monitoring: {
        enabled: true,
        logSecurityEvents: true,
        trackRateLimitViolations: true,
        alertOnSuspiciousActivity: false
    }
};

/**
 * Get security configuration based on environment
 */
export function getSecurityConfig(): SecurityConfig {
    const env = process.env.NODE_ENV || 'development';

    switch (env) {
        case 'production':
            return { ...defaultConfig, ...productionConfig };
        case 'development':
            return { ...defaultConfig, ...developmentConfig };
        case 'test':
            return {
                ...defaultConfig,
                rateLimit: { ...defaultConfig.rateLimit, enabled: false },
                monitoring: { ...defaultConfig.monitoring, enabled: false }
            };
        default:
            return { ...defaultConfig, ...developmentConfig };
    }
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig() {
    return getSecurityConfig().environment;
}

/**
 * Check if security feature is enabled
 */
export function isSecurityFeatureEnabled(feature: keyof SecurityConfig): boolean {
    const config = getSecurityConfig();
    const featureConfig = config[feature];

    // Check if the feature config has an 'enabled' property
    if (featureConfig && typeof featureConfig === 'object' && 'enabled' in featureConfig) {
        return (featureConfig as any).enabled;
    }

    return false;
}

/**
 * Get rate limit configuration
 */
export function getRateLimitConfig() {
    return getSecurityConfig().rateLimit;
}

/**
 * Get CORS configuration
 */
export function getCorsConfig() {
    return getSecurityConfig().cors;
}

/**
 * Get headers configuration
 */
export function getHeadersConfig() {
    return getSecurityConfig().headers;
}

/**
 * Get validation configuration
 */
export function getValidationConfig() {
    return getSecurityConfig().validation;
}

/**
 * Get monitoring configuration
 */
export function getMonitoringConfig() {
    return getSecurityConfig().monitoring;
}

/**
 * Validate security configuration
 */
export function validateSecurityConfig(config: SecurityConfig): string[] {
    const errors: string[] = [];

    if (config.rateLimit.maxRequests <= 0) {
        errors.push('Rate limit maxRequests must be positive');
    }

    if (config.rateLimit.windowMs <= 0) {
        errors.push('Rate limit windowMs must be positive');
    }

    if (config.rateLimit.blockDurationMs <= 0) {
        errors.push('Rate limit blockDurationMs must be positive');
    }

    if (config.validation.maxBodySize <= 0) {
        errors.push('Validation maxBodySize must be positive');
    }

    if (config.validation.maxQueryParams <= 0) {
        errors.push('Validation maxQueryParams must be positive');
    }

    return errors;
}

/**
 * Export the current security configuration
 */
export const securityConfig = getSecurityConfig();

// Validate configuration on import
const configErrors = validateSecurityConfig(securityConfig);
if (configErrors.length > 0) {
    console.error('[SECURITY] Configuration validation errors:', configErrors);
    throw new Error(`Security configuration validation failed: ${configErrors.join(', ')}`);
} 
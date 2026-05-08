// Types for SystemAdminSettings components
import type {
    SSOConfig,
    HRMSConfig,
    ERPConfig,
    CommunicationConfig,
} from '@/hooks/useIntegrations';

// System Info types
export interface SystemInfo {
    database: {
        type: string;
        host: string;
        port: string;
        name: string;
        connected: boolean;
    };
    cache: {
        host: string;
        port: string;
        connected: boolean;
        memory_used?: string;
    };
    app: {
        name: string;
        environment: string;
        version: string;
    };
}

// Platform settings state
export interface PlatformSettings {
    supportEmail: string;
    defaultSessionTimeout: number;
    maxLoginAttempts: number;
    enableAuditLogging: boolean;
    maintenanceMode: boolean;
    maintenanceMessage: string;
}

// Email settings state
export interface EmailSettings {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    smtpSecure: boolean;
    senderEmail: string;
    senderName: string;
    enableEmailNotifications: boolean;
    emailFooter: string;
}

// Session timeout options
export interface SessionTimeoutOption {
    value: number;
    label: string;
}

export const SESSION_TIMEOUT_OPTIONS: SessionTimeoutOption[] = [
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 120, label: '2 hours' },
    { value: 240, label: '4 hours' },
    { value: 480, label: '8 hours (Default)' },
    { value: 1440, label: '24 hours' },
];

// Default values
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
    supportEmail: 'support@easyqlaim.com',
    defaultSessionTimeout: 480,
    maxLoginAttempts: 5,
    enableAuditLogging: true,
    maintenanceMode: false,
    maintenanceMessage: 'The system is currently undergoing scheduled maintenance. Please try again later.',
};

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    smtpSecure: true,
    senderEmail: 'noreply@easyqlaim.com',
    senderName: 'EasyQlaim',
    enableEmailNotifications: true,
    emailFooter: 'This is an automated message from EasyQlaim. Please do not reply directly to this email.',
};

// Webhook events
export const WEBHOOK_EVENTS = ['claim.created', 'claim.approved', 'claim.rejected', 'claim.settled'];

// Re-export integration types for convenience
export type { SSOConfig, HRMSConfig, ERPConfig, CommunicationConfig };

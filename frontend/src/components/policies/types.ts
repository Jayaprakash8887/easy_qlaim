// Types for Policies components

// Policy Category
export interface PolicyCategory {
    id: string;
    tenant_id: string;
    policy_upload_id: string;
    category_name: string;
    category_code: string;
    category_type: 'REIMBURSEMENT' | 'ALLOWANCE';
    description?: string;
    max_amount?: number;
    min_amount?: number;
    currency: string;
    frequency_limit?: string;
    frequency_count?: number;
    eligibility_criteria: Record<string, unknown>;
    requires_receipt: boolean;
    requires_approval_above?: number;
    allowed_document_types: string[];
    submission_window_days?: number;
    is_active: boolean;
    display_order: number;
    source_text?: string;
    ai_confidence?: number;
    created_at: string;
    updated_at: string;
}

// Policy Upload
export interface PolicyUpload {
    id: string;
    tenant_id: string;
    policy_name: string;
    policy_number: string;
    description?: string;
    file_name: string;
    file_type: string;
    file_size?: number;
    storage_path?: string;
    gcs_uri?: string;
    storage_type: string;
    status: string;
    extracted_text?: string;
    extraction_error?: string;
    extracted_at?: string;
    extracted_data: Record<string, unknown>;
    version: number;
    is_active: boolean;
    effective_from?: string;
    effective_to?: string;
    uploaded_by: string;
    approved_by?: string;
    approved_at?: string;
    review_notes?: string;
    created_at: string;
    updated_at: string;
    region?: string[];
    categories: PolicyCategory[];
}

// Policy List Item
export interface PolicyUploadListItem {
    id: string;
    policy_name: string;
    policy_number: string;
    file_name: string;
    status: string;
    version: number;
    is_active: boolean;
    effective_from?: string;
    region?: string[];
    categories_count: number;
    uploaded_by: string;
    created_at: string;
}

// Custom Field Validation
export interface CustomFieldValidation {
    min_length?: number;
    max_length?: number;
    min?: number;
    max?: number;
    pattern?: string;
}

// Custom Field Definition
export interface CustomFieldDefinition {
    name: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select' | 'file' | 'boolean' | 'currency' | 'location';
    required: boolean;
    placeholder?: string;
    options: string[];
    validation?: CustomFieldValidation;
    default_value?: unknown;
}

// Custom Claim
export interface CustomClaim {
    id: string;
    tenant_id: string;
    claim_name: string;
    claim_code: string;
    description?: string;
    category_type: 'REIMBURSEMENT' | 'ALLOWANCE';
    region?: string[];
    max_amount?: number;
    min_amount?: number;
    default_amount?: number;
    currency: string;
    frequency_limit?: string;
    frequency_count?: number;
    custom_fields: CustomFieldDefinition[];
    eligibility_criteria: Record<string, unknown>;
    requires_receipt: boolean;
    requires_approval_above?: number;
    allowed_document_types: string[];
    submission_window_days?: number;
    is_active: boolean;
    display_order: number;
    created_by: string;
    updated_by?: string;
    created_at: string;
    updated_at: string;
}

// Custom Claim List Item
export interface CustomClaimListItem {
    id: string;
    claim_name: string;
    claim_code: string;
    description?: string;
    category_type: 'REIMBURSEMENT' | 'ALLOWANCE';
    region?: string[];
    max_amount?: number;
    currency: string;
    requires_receipt: boolean;
    is_active: boolean;
    fields_count: number;
    created_at: string;
}

// Form State Types
export interface PolicyUploadFormState {
    policy_name: string;
    description: string;
    region: string[];
    file: File | null;
}

export interface NewVersionFormState {
    description: string;
    region: string[];
    file: File | null;
}

export interface CustomClaimFormState {
    claim_name: string;
    description: string;
    category_type: 'REIMBURSEMENT' | 'ALLOWANCE';
    region: string[];
    max_amount: string;
    min_amount: string;
    default_amount: string;
    currency: string;
    frequency_limit: string;
    frequency_count: string;
    requires_receipt: boolean;
    requires_approval_above: string;
    submission_window_days: string;
    custom_fields: CustomFieldDefinition[];
}

// Constants
export const FIELD_TYPE_OPTIONS = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'currency', label: 'Currency' },
    { value: 'date', label: 'Date' },
    { value: 'select', label: 'Dropdown Select' },
    { value: 'boolean', label: 'Yes/No (Checkbox)' },
    { value: 'file', label: 'File Upload' },
    { value: 'location', label: 'Location (Map)' },
];

export const FREQUENCY_OPTIONS = [
    { value: '', label: 'No Limit' },
    { value: 'ONCE', label: 'Once Only' },
    { value: 'DAILY', label: 'Daily' },
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'QUARTERLY', label: 'Quarterly' },
    { value: 'YEARLY', label: 'Yearly' },
    { value: 'UNLIMITED', label: 'Unlimited' },
];

// Default values
export const DEFAULT_CUSTOM_CLAIM_FORM: CustomClaimFormState = {
    claim_name: '',
    description: '',
    category_type: 'REIMBURSEMENT',
    region: [],
    max_amount: '',
    min_amount: '',
    default_amount: '',
    currency: 'INR',
    frequency_limit: '',
    frequency_count: '',
    requires_receipt: true,
    requires_approval_above: '',
    submission_window_days: '',
    custom_fields: [],
};

export const getEmptyCustomField = (): CustomFieldDefinition => ({
    name: '',
    label: '',
    type: 'text',
    required: false,
    placeholder: '',
    options: [],
    validation: undefined,
    default_value: undefined,
});

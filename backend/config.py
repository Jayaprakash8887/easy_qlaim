"""
Configuration module for the Reimbursement Validation System
"""
from pydantic_settings import BaseSettings
from typing import List, Optional
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    APP_NAME: str = "Reimbursement Validation System"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str
    
    # Database
    DATABASE_URL: str
    MONGODB_URI: str
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_URL: str = "redis://localhost:6379/1"
    
    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    CELERY_TASK_ALWAYS_EAGER: bool = False
    
    # ===========================================
    # MULTI-VENDOR PROVIDER CONFIGURATION
    # ===========================================
    
    # Provider Selection (choose which cloud/service to use)
    STORAGE_PROVIDER: str = "gcs"  # Options: gcs, azure, aws, local
    LLM_PROVIDER: str = "gemini"   # Options: gemini, openai, azure_openai, anthropic, bedrock, ollama
    VISION_PROVIDER: str = "tesseract"  # Options: google-vision, azure-vision, textract, tesseract
    
    # ===========================================
    # GOOGLE CLOUD CONFIGURATION
    # ===========================================
    
    # Google AI / Gemini
    GOOGLE_API_KEY: str
    GEMINI_MODEL: str = "gemini-2.0-flash-exp"
    GEMINI_TEMPERATURE: float = 0.7
    GEMINI_MAX_TOKENS: int = 5000
    
    # Google Cloud Storage
    GCP_PROJECT_ID: str = "spanish-translation-419206"
    GCP_BUCKET_NAME: str = "agents007-hackathon-jp-2024"
    GCP_CREDENTIALS_PATH: Optional[str] = "../spanish-translation-419206-0b4ae2c983f6.json"
    
    # ===========================================
    # AZURE CONFIGURATION
    # ===========================================
    
    # Azure Storage
    AZURE_STORAGE_CONNECTION_STRING: Optional[str] = None
    AZURE_STORAGE_ACCOUNT_NAME: Optional[str] = None
    AZURE_STORAGE_ACCOUNT_KEY: Optional[str] = None
    AZURE_STORAGE_CONTAINER: str = "documents"
    
    # Azure OpenAI
    AZURE_OPENAI_API_KEY: Optional[str] = None
    AZURE_OPENAI_ENDPOINT: Optional[str] = None
    AZURE_OPENAI_DEPLOYMENT: Optional[str] = None
    AZURE_OPENAI_API_VERSION: str = "2024-02-15-preview"
    AZURE_OPENAI_TEMPERATURE: float = 0.7
    AZURE_OPENAI_MAX_TOKENS: int = 4096
    
    # Azure Computer Vision
    AZURE_VISION_ENDPOINT: Optional[str] = None
    AZURE_VISION_API_KEY: Optional[str] = None
    
    # ===========================================
    # AWS CONFIGURATION
    # ===========================================
    
    # AWS Credentials
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    
    # AWS S3 Storage
    AWS_S3_BUCKET: Optional[str] = None
    
    # AWS Bedrock LLM
    BEDROCK_MODEL_ID: str = "anthropic.claude-3-sonnet-20240229-v1:0"
    BEDROCK_TEMPERATURE: float = 0.7
    BEDROCK_MAX_TOKENS: int = 4096
    
    # ===========================================
    # OPENAI CONFIGURATION
    # ===========================================
    
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4-turbo-preview"
    OPENAI_TEMPERATURE: float = 0.7
    OPENAI_MAX_TOKENS: int = 4096
    OPENAI_ORGANIZATION: Optional[str] = None
    
    # ===========================================
    # ANTHROPIC CONFIGURATION
    # ===========================================
    
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"
    ANTHROPIC_TEMPERATURE: float = 0.7
    ANTHROPIC_MAX_TOKENS: int = 4096
    
    # ===========================================
    # OLLAMA (LOCAL LLM) CONFIGURATION
    # ===========================================
    
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    OLLAMA_TEMPERATURE: float = 0.7
    OLLAMA_MAX_TOKENS: int = 4096
    
    # ===========================================
    # OCR CONFIGURATION
    # ===========================================
    
    # Local storage for development
    LOCAL_STORAGE_PATH: str = "./uploads"
    
    # Tesseract OCR Settings
    TESSERACT_LANG: str = "eng"
    TESSERACT_CMD: Optional[str] = None
    
    # OCR Settings
    OCR_ENGINE: str = "tesseract"
    OCR_LANG: str = "en"
    OCR_CONFIDENCE_THRESHOLD: float = 0.8
    OCR_LLM_FALLBACK_THRESHOLD: float = 0.9  # If OCR confidence < this, use LLM Vision API for OCR
    OCR_USE_LLM_FALLBACK: bool = True  # Enable/disable LLM Vision API fallback for low-confidence OCR
    
    # Authentication
    KEYCLOAK_SERVER_URL: Optional[str] = None
    KEYCLOAK_REALM: Optional[str] = None
    KEYCLOAK_CLIENT_ID: Optional[str] = None
    KEYCLOAK_CLIENT_SECRET: Optional[str] = None
    
    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "dev@localhost"
    SMTP_PASSWORD: str = "dev-password"
    SMTP_FROM: str = "dev@localhost"
    
    # External Integrations
    HRMS_ENABLED: bool = False
    HRMS_API_URL: Optional[str] = None
    HRMS_API_KEY: Optional[str] = None
    HRMS_FALLBACK_TO_LOCAL: bool = True
    
    KRONOS_ENABLED: bool = False
    KRONOS_API_URL: Optional[str] = None
    KRONOS_API_KEY: Optional[str] = None
    KRONOS_FALLBACK_TO_LOCAL: bool = True
    
    PAYROLL_ENABLED: bool = False
    PAYROLL_API_URL: Optional[str] = None
    PAYROLL_API_KEY: Optional[str] = None
    
    # Feature Flags
    ENABLE_AUTO_APPROVAL: bool = True
    AUTO_APPROVAL_CONFIDENCE_THRESHOLD: float = 0.95
    ENABLE_OCR: bool = True
    ENABLE_AI_VALIDATION: bool = True
    ENABLE_LEARNING_AGENT: bool = True
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "/var/log/reimbursement/app.log"
    
    # CORS - Allow all common development ports
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080,http://127.0.0.1:8080,http://localhost:4173"
    CORS_ALLOW_CREDENTIALS: bool = True
    
    # Tenant
    MULTI_TENANT_ENABLED: bool = False
    DEFAULT_TENANT_ID: str = "00000000-0000-0000-0000-000000000001"
    
    # File Upload
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_EXTENSIONS: str = "pdf,jpg,jpeg,png,xlsx,xls"
    LOCAL_FILE_RETENTION_DAYS: int = 30  # Delete local files after this many days
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins string into list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    @property
    def allowed_extensions_list(self) -> List[str]:
        """Parse allowed extensions string into list"""
        return [ext.strip() for ext in self.ALLOWED_EXTENSIONS.split(",")]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Export settings instance
settings = get_settings()

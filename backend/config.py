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
    
    # Google AI
    GOOGLE_API_KEY: str
    GEMINI_MODEL: str = "gemini-2.0-flash-exp"
    GEMINI_TEMPERATURE: float = 0.7
    GEMINI_MAX_TOKENS: int = 2048
    
    # Google Cloud Storage
    GCP_PROJECT_ID: str = "dev-project"
    GCP_BUCKET_NAME: str = "dev-bucket"
    GCP_CREDENTIALS_PATH: Optional[str] = None
    
    # OCR
    OCR_ENGINE: str = "paddleocr"
    OCR_LANG: str = "en"
    OCR_CONFIDENCE_THRESHOLD: float = 0.8
    
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
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    CORS_ALLOW_CREDENTIALS: bool = True
    
    # Tenant
    MULTI_TENANT_ENABLED: bool = False
    DEFAULT_TENANT_ID: str = "default-tenant"
    
    # File Upload
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_EXTENSIONS: str = "pdf,jpg,jpeg,png,xlsx,xls"
    
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

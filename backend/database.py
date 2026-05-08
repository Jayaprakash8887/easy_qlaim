"""
Database connection and session management
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from typing import Generator, AsyncGenerator
from config import settings
from models import Base
import logging

logger = logging.getLogger(__name__)

# Sync engine for non-async operations
sync_engine = create_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,
    pool_recycle=1800,  # Recycle connections every 30 minutes
    pool_timeout=30,    # Wait up to 30 seconds for a connection
    connect_args={"connect_timeout": 10},  # Connection timeout
    echo=settings.DEBUG,
)

# Async engine for FastAPI async operations
async_engine = create_async_engine(
    settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"),
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,
    pool_recycle=1800,  # Recycle connections every 30 minutes
    pool_timeout=30,    # Wait up to 30 seconds for a connection
    echo=settings.DEBUG,
)

# Session makers
SyncSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=sync_engine,
    class_=Session,
)

AsyncSessionLocal = async_sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


def get_sync_db() -> Generator[Session, None, None]:
    """
    Get synchronous database session for Celery workers
    """
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Get asynchronous database session for FastAPI
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


def init_db():
    """
    Initialize database tables
    """
    try:
        Base.metadata.create_all(bind=sync_engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise


async def init_db_async():
    """
    Initialize database tables asynchronously and seed platform admin
    """
    try:
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully (async)")
        
        # Seed platform admin after tables are created
        await seed_platform_admin()
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise


async def seed_platform_admin():
    """
    Create Platform Administration tenant and default System Admin user if they don't exist.
    This runs on every startup but only creates records if they don't already exist.
    """
    import hashlib
    from uuid import uuid4
    from models import Tenant, User
    
    try:
        db = SyncSessionLocal()
        
        # Check if Platform tenant exists
        platform_tenant = db.query(Tenant).filter(Tenant.code == 'PLATFORM').first()
        
        if not platform_tenant:
            # Create Platform Administration tenant
            platform_tenant = Tenant(
                id=uuid4(),
                name='Platform Administration',
                code='PLATFORM',
                domain=None,
                settings={'is_platform_tenant': True},
                is_active=True
            )
            db.add(platform_tenant)
            db.commit()
            db.refresh(platform_tenant)
            logger.info(f"Created Platform Administration tenant: {platform_tenant.id}")
        else:
            logger.info("Platform Administration tenant already exists")
        
        # Check if default System Admin user exists
        sysadmin = db.query(User).filter(User.email == 'system_admin@easyqlaim.com').first()
        
        if not sysadmin:
            # Create default System Admin user
            sysadmin = User(
                id=uuid4(),
                tenant_id=platform_tenant.id,
                username='system_admin',
                email='system_admin@easyqlaim.com',
                hashed_password=hashlib.sha256('EQAdmin@2025'.encode()).hexdigest(),
                employee_code='SYSADMIN001',
                first_name='System',
                last_name='Admin',
                full_name='System Admin',
                department='Platform',
                designation='System Administrator',
                employment_status='ACTIVE',
                region='GLOBAL',
                roles=['SYSTEM_ADMIN'],
                is_active=True
            )
            db.add(sysadmin)
            db.commit()
            logger.info(f"Created default System Admin user: system_admin@easyqlaim.com")
        else:
            logger.info("Default System Admin user already exists")
        
        db.close()
        
    except Exception as e:
        logger.error(f"Error seeding platform admin: {e}")
        # Don't raise - this should not prevent app startup


def drop_db():
    """
    Drop all database tables (use with caution!)
    """
    try:
        Base.metadata.drop_all(bind=sync_engine)
        logger.warning("All database tables dropped")
    except Exception as e:
        logger.error(f"Error dropping database tables: {e}")
        raise

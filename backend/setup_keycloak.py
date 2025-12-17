"""
Keycloak Setup Script
Initializes Keycloak realm, client, and syncs users from PostgreSQL database.
"""
import asyncio
import logging
import sys
from uuid import UUID

# Add parent directory to path for imports
sys.path.insert(0, '.')

from database import SyncSessionLocal
from models import User, Tenant
from services.keycloak_service import get_keycloak_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Password mappings
TARENTO_TENANT_ID = UUID('9af8238c-692d-4765-8be2-bcaa5ab1cac2')
PLATFORM_TENANT_ID = UUID('a7e76072-5f7f-4096-a304-05fb58adb3bd')

TARENTO_PASSWORD = "Test@123"
ADMIN_PASSWORD = "Admin@123"


async def setup_keycloak():
    """Setup Keycloak realm and client."""
    keycloak = get_keycloak_service()
    
    logger.info("Setting up Keycloak realm and client...")
    success = await keycloak.setup_realm_and_client()
    
    if success:
        logger.info("✓ Keycloak realm and client setup complete")
    else:
        logger.error("✗ Failed to setup Keycloak realm and client")
        return False
    
    return True


async def sync_users_to_keycloak():
    """Sync all users from PostgreSQL to Keycloak with appropriate passwords."""
    keycloak = get_keycloak_service()
    db = SyncSessionLocal()
    
    try:
        users = db.query(User).filter(User.is_active == True).all()
        logger.info(f"Found {len(users)} active users to sync")
        
        success_count = 0
        fail_count = 0
        
        for user in users:
            # Determine password based on tenant
            if user.tenant_id == PLATFORM_TENANT_ID or (user.roles and 'SYSTEM_ADMIN' in user.roles):
                password = ADMIN_PASSWORD
                user_type = "Admin"
            else:
                password = TARENTO_PASSWORD
                user_type = "Tarento Employee"
            
            # Create user attributes
            attributes = {
                "db_user_id": [str(user.id)],
                "tenant_id": [str(user.tenant_id)] if user.tenant_id else [],
                "department": [user.department] if user.department else [],
                "designation": [user.designation] if user.designation else [],
                "roles": user.roles if user.roles else ["EMPLOYEE"],
            }
            
            logger.info(f"Creating Keycloak user: {user.email} ({user_type})")
            
            user_id = await keycloak.create_user(
                email=user.email,
                password=password,
                first_name=user.first_name,
                last_name=user.last_name,
                enabled=True,
                email_verified=True,
                attributes=attributes
            )
            
            if user_id:
                logger.info(f"  ✓ Created/Updated: {user.email}")
                success_count += 1
            else:
                logger.error(f"  ✗ Failed: {user.email}")
                fail_count += 1
        
        logger.info(f"\nSync complete: {success_count} succeeded, {fail_count} failed")
        return success_count > 0
        
    finally:
        db.close()


async def main():
    """Main entry point."""
    logger.info("=" * 60)
    logger.info("Keycloak Setup and User Sync")
    logger.info("=" * 60)
    
    # Wait for Keycloak to be ready
    logger.info("\nWaiting for Keycloak to be ready...")
    import httpx
    
    # Use master realm endpoint instead of health check
    keycloak_url = "http://localhost:8180/realms/master"
    max_retries = 30
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(keycloak_url, timeout=5.0)
                if response.status_code == 200:
                    logger.info("✓ Keycloak is ready")
                    break
        except Exception:
            pass
        
        retry_count += 1
        logger.info(f"  Waiting... ({retry_count}/{max_retries})")
        await asyncio.sleep(2)
    
    if retry_count >= max_retries:
        logger.error("✗ Keycloak not ready after maximum retries")
        logger.info("  Make sure Keycloak is running: docker-compose up keycloak")
        return
    
    # Setup realm and client
    if not await setup_keycloak():
        return
    
    # Sync users
    logger.info("\n" + "-" * 60)
    logger.info("Syncing users to Keycloak...")
    logger.info("-" * 60)
    
    await sync_users_to_keycloak()
    
    logger.info("\n" + "=" * 60)
    logger.info("Setup Complete!")
    logger.info("=" * 60)
    logger.info("\nUser Credentials:")
    logger.info(f"  Tarento Employees: [email]@tarento.com / {TARENTO_PASSWORD}")
    logger.info(f"  System Admins: admin@tarento.com, sysadmin@tarento.com / {ADMIN_PASSWORD}")
    logger.info("\nKeycloak Admin Console:")
    logger.info("  URL: http://localhost:8180/admin")
    logger.info("  Username: admin")
    logger.info("  Password: admin")


if __name__ == "__main__":
    asyncio.run(main())

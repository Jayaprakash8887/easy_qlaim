"""
Keycloak Authentication Service
Handles integration with Keycloak for user authentication and management.
"""
import logging
import httpx
from typing import Optional, Dict, Any, List
from uuid import UUID
from jose import jwt, JWTError
from jose.exceptions import ExpiredSignatureError
from functools import lru_cache
import time

from config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


class KeycloakService:
    """Service for Keycloak authentication and user management."""
    
    def __init__(self):
        self.server_url = settings.KEYCLOAK_SERVER_URL
        self.realm = settings.KEYCLOAK_REALM
        self.client_id = settings.KEYCLOAK_CLIENT_ID
        self.client_secret = settings.KEYCLOAK_CLIENT_SECRET
        self.admin_username = settings.KEYCLOAK_ADMIN_USERNAME
        self.admin_password = settings.KEYCLOAK_ADMIN_PASSWORD
        self._admin_token: Optional[str] = None
        self._admin_token_expires: float = 0
        self._public_key: Optional[str] = None
        self._public_key_fetched: float = 0
    
    @property
    def base_url(self) -> str:
        return f"{self.server_url}/realms/{self.realm}"
    
    @property
    def admin_base_url(self) -> str:
        return f"{self.server_url}/admin/realms/{self.realm}"
    
    @property
    def token_url(self) -> str:
        return f"{self.base_url}/protocol/openid-connect/token"
    
    @property
    def userinfo_url(self) -> str:
        return f"{self.base_url}/protocol/openid-connect/userinfo"
    
    @property
    def certs_url(self) -> str:
        return f"{self.base_url}/protocol/openid-connect/certs"
    
    @property
    def logout_url(self) -> str:
        return f"{self.base_url}/protocol/openid-connect/logout"
    
    async def get_public_key(self) -> str:
        """Fetch and cache the realm's public key for token verification."""
        # Cache for 1 hour
        if self._public_key and time.time() - self._public_key_fetched < 3600:
            return self._public_key
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(self.certs_url)
                response.raise_for_status()
                keys = response.json().get("keys", [])
                
                # Find RSA key
                for key in keys:
                    if key.get("use") == "sig" and key.get("kty") == "RSA":
                        # Construct PEM from modulus and exponent
                        from jose.backends.rsa_backend import RSAKey
                        rsa_key = RSAKey(key, "RS256")
                        self._public_key = rsa_key.public_key().export_key()
                        self._public_key_fetched = time.time()
                        return self._public_key
                
                # Fallback: Get from realm info
                realm_response = await client.get(self.base_url)
                realm_response.raise_for_status()
                realm_info = realm_response.json()
                public_key = realm_info.get("public_key")
                if public_key:
                    self._public_key = f"-----BEGIN PUBLIC KEY-----\n{public_key}\n-----END PUBLIC KEY-----"
                    self._public_key_fetched = time.time()
                    return self._public_key
                    
        except Exception as e:
            logger.error(f"Failed to fetch Keycloak public key: {e}")
        
        return ""
    
    async def get_admin_token(self) -> str:
        """Get admin access token for Keycloak Admin API."""
        if self._admin_token and time.time() < self._admin_token_expires:
            return self._admin_token
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.server_url}/realms/master/protocol/openid-connect/token",
                    data={
                        "grant_type": "password",
                        "client_id": "admin-cli",
                        "username": self.admin_username,
                        "password": self.admin_password,
                    }
                )
                response.raise_for_status()
                data = response.json()
                self._admin_token = data["access_token"]
                self._admin_token_expires = time.time() + data.get("expires_in", 300) - 30
                return self._admin_token
        except Exception as e:
            logger.error(f"Failed to get Keycloak admin token: {e}")
            raise
    
    async def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode a Keycloak access token."""
        try:
            # First try to get user info (validates token with Keycloak)
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self.userinfo_url,
                    headers={"Authorization": f"Bearer {token}"}
                )
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 401:
                    logger.warning("Token validation failed: Unauthorized")
                    return None
                else:
                    logger.warning(f"Token validation failed: {response.status_code}")
                    return None
        except Exception as e:
            logger.error(f"Error verifying token: {e}")
            return None
    
    async def authenticate(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """Authenticate user with username/email and password."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.token_url,
                    data={
                        "grant_type": "password",
                        "client_id": self.client_id,
                        "username": username,
                        "password": password,
                    }
                )
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 401:
                    logger.warning(f"Authentication failed for user: {username}")
                    return None
                else:
                    logger.error(f"Authentication error: {response.status_code} - {response.text}")
                    return None
        except Exception as e:
            logger.error(f"Error during authentication: {e}")
            return None
    
    async def refresh_token(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        """Refresh an access token using a refresh token."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.token_url,
                    data={
                        "grant_type": "refresh_token",
                        "client_id": self.client_id,
                        "refresh_token": refresh_token,
                    }
                )
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.warning(f"Token refresh failed: {response.status_code}")
                    return None
        except Exception as e:
            logger.error(f"Error refreshing token: {e}")
            return None
    
    async def logout(self, refresh_token: str) -> bool:
        """Logout user by invalidating their refresh token."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.logout_url,
                    data={
                        "client_id": self.client_id,
                        "refresh_token": refresh_token,
                    }
                )
                return response.status_code == 204
        except Exception as e:
            logger.error(f"Error during logout: {e}")
            return False
    
    # ============ User Management (Admin API) ============
    
    async def create_user(
        self,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        enabled: bool = True,
        email_verified: bool = True,
        attributes: Optional[Dict[str, List[str]]] = None
    ) -> Optional[str]:
        """Create a new user in Keycloak."""
        try:
            admin_token = await self.get_admin_token()
            
            user_data = {
                "username": email,
                "email": email,
                "firstName": first_name,
                "lastName": last_name,
                "enabled": enabled,
                "emailVerified": email_verified,
                "credentials": [{
                    "type": "password",
                    "value": password,
                    "temporary": False
                }],
            }
            
            if attributes:
                user_data["attributes"] = attributes
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.admin_base_url}/users",
                    json=user_data,
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
                
                if response.status_code == 201:
                    # Get user ID from Location header
                    location = response.headers.get("Location", "")
                    user_id = location.split("/")[-1] if location else None
                    logger.info(f"Created Keycloak user: {email}")
                    return user_id
                elif response.status_code == 409:
                    logger.warning(f"User already exists: {email}")
                    # Get existing user
                    existing_user = await self.get_user_by_email(email)
                    return existing_user.get("id") if existing_user else None
                else:
                    logger.error(f"Failed to create user: {response.status_code} - {response.text}")
                    return None
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            return None
    
    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email address."""
        try:
            admin_token = await self.get_admin_token()
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.admin_base_url}/users",
                    params={"email": email, "exact": "true"},
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
                
                if response.status_code == 200:
                    users = response.json()
                    return users[0] if users else None
                else:
                    logger.error(f"Failed to get user: {response.status_code}")
                    return None
        except Exception as e:
            logger.error(f"Error getting user: {e}")
            return None
    
    async def update_user_password(self, user_id: str, password: str) -> bool:
        """Update a user's password."""
        try:
            admin_token = await self.get_admin_token()
            
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    f"{self.admin_base_url}/users/{user_id}/reset-password",
                    json={
                        "type": "password",
                        "value": password,
                        "temporary": False
                    },
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
                
                if response.status_code == 204:
                    logger.info(f"Updated password for user: {user_id}")
                    return True
                else:
                    logger.error(f"Failed to update password: {response.status_code}")
                    return False
        except Exception as e:
            logger.error(f"Error updating password: {e}")
            return False
    
    async def delete_user(self, user_id: str) -> bool:
        """Delete a user from Keycloak."""
        try:
            admin_token = await self.get_admin_token()
            
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{self.admin_base_url}/users/{user_id}",
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
                
                return response.status_code == 204
        except Exception as e:
            logger.error(f"Error deleting user: {e}")
            return False
    
    async def get_all_users(self) -> List[Dict[str, Any]]:
        """Get all users from Keycloak."""
        try:
            admin_token = await self.get_admin_token()
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.admin_base_url}/users",
                    params={"max": 1000},
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Failed to get users: {response.status_code}")
                    return []
        except Exception as e:
            logger.error(f"Error getting users: {e}")
            return []
    
    # ============ Realm and Client Management ============
    
    async def create_realm(self) -> bool:
        """Create the reimbursement realm if it doesn't exist."""
        try:
            admin_token = await self.get_admin_token()
            
            async with httpx.AsyncClient() as client:
                # Check if realm exists
                response = await client.get(
                    f"{self.server_url}/admin/realms/{self.realm}",
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
                
                if response.status_code == 200:
                    logger.info(f"Realm '{self.realm}' already exists")
                    return True
                
                # Create realm
                realm_config = {
                    "realm": self.realm,
                    "enabled": True,
                    "displayName": "Reimbursement System",
                    "registrationAllowed": False,
                    "loginWithEmailAllowed": True,
                    "duplicateEmailsAllowed": False,
                    "resetPasswordAllowed": True,
                    "editUsernameAllowed": False,
                    "bruteForceProtected": True,
                    "accessTokenLifespan": 1800,  # 30 minutes
                    "ssoSessionIdleTimeout": 3600,  # 1 hour
                    "ssoSessionMaxLifespan": 36000,  # 10 hours
                }
                
                response = await client.post(
                    f"{self.server_url}/admin/realms",
                    json=realm_config,
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
                
                if response.status_code == 201:
                    logger.info(f"Created realm: {self.realm}")
                    return True
                else:
                    logger.error(f"Failed to create realm: {response.status_code} - {response.text}")
                    return False
        except Exception as e:
            logger.error(f"Error creating realm: {e}")
            return False
    
    async def create_client(self) -> bool:
        """Create the application client if it doesn't exist."""
        try:
            admin_token = await self.get_admin_token()
            
            async with httpx.AsyncClient() as client:
                # Check if client exists
                response = await client.get(
                    f"{self.admin_base_url}/clients",
                    params={"clientId": self.client_id},
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
                
                if response.status_code == 200 and response.json():
                    logger.info(f"Client '{self.client_id}' already exists")
                    return True
                
                # Create client
                client_config = {
                    "clientId": self.client_id,
                    "name": "Reimbursement Application",
                    "enabled": True,
                    "publicClient": True,
                    "directAccessGrantsEnabled": True,
                    "standardFlowEnabled": True,
                    "implicitFlowEnabled": False,
                    "serviceAccountsEnabled": False,
                    "redirectUris": [
                        "http://localhost:8080/*",
                        "http://localhost:5173/*",
                        "http://localhost:3000/*",
                    ],
                    "webOrigins": [
                        "http://localhost:8080",
                        "http://localhost:5173",
                        "http://localhost:3000",
                    ],
                    "attributes": {
                        "pkce.code.challenge.method": "S256"
                    }
                }
                
                response = await client.post(
                    f"{self.admin_base_url}/clients",
                    json=client_config,
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
                
                if response.status_code == 201:
                    logger.info(f"Created client: {self.client_id}")
                    return True
                else:
                    logger.error(f"Failed to create client: {response.status_code} - {response.text}")
                    return False
        except Exception as e:
            logger.error(f"Error creating client: {e}")
            return False
    
    async def setup_realm_and_client(self) -> bool:
        """Setup Keycloak realm and client."""
        realm_created = await self.create_realm()
        if not realm_created:
            return False
        
        client_created = await self.create_client()
        return client_created


# Singleton instance
_keycloak_service: Optional[KeycloakService] = None


def get_keycloak_service() -> KeycloakService:
    """Get the Keycloak service singleton."""
    global _keycloak_service
    if _keycloak_service is None:
        _keycloak_service = KeycloakService()
    return _keycloak_service

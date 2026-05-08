"""
Storage Service for document uploads

Uses the multi-vendor provider abstraction layer to support:
- Google Cloud Storage (GCS)
- Azure Blob Storage
- AWS S3
- Local filesystem (for development)

Configuration is done via environment variables:
- STORAGE_PROVIDER: gcs | azure | aws | local
"""
import os
import logging
from pathlib import Path
from typing import Optional, Tuple
from uuid import uuid4
from datetime import timedelta

from config import settings

logger = logging.getLogger(__name__)

# Import provider abstraction
try:
    from services.providers.storage_provider import get_storage_provider, reset_storage_provider
    USE_PROVIDER_ABSTRACTION = True
except ImportError:
    USE_PROVIDER_ABSTRACTION = False
    logger.warning("Provider abstraction not available, using direct GCS client")

# Direct GCS client (fallback when provider abstraction unavailable)
_gcs_client = None
_gcs_bucket = None


def is_cloud_storage_configured() -> bool:
    """
    Check if cloud storage is properly configured and working.
    
    Returns:
        True if cloud storage is configured and accessible, False otherwise
    """
    # Check if GCP settings are configured
    if settings.GCP_PROJECT_ID and settings.GCP_BUCKET_NAME:
        try:
            client, bucket = get_gcs_client()
            if client and bucket:
                # Try to check if bucket exists (lightweight operation)
                return bucket.exists()
        except Exception as e:
            logger.warning(f"Cloud storage check failed: {e}")
            return False
    
    # Check Azure storage settings
    if settings.AZURE_STORAGE_CONNECTION_STRING or (settings.AZURE_STORAGE_ACCOUNT_NAME and settings.AZURE_STORAGE_ACCOUNT_KEY):
        if USE_PROVIDER_ABSTRACTION:
            try:
                provider = get_storage_provider()
                # Try a simple operation to verify connection
                return provider is not None
            except Exception as e:
                logger.warning(f"Azure storage check failed: {e}")
                return False
    
    return False


def get_cloud_storage_status() -> dict:
    """
    Get detailed status of cloud storage configuration.
    
    Returns:
        Dict with storage status details
    """
    status = {
        "configured": False,
        "provider": None,
        "bucket_name": None,
        "accessible": False,
        "error": None
    }
    
    # Check GCS
    if settings.GCP_PROJECT_ID and settings.GCP_BUCKET_NAME:
        status["provider"] = "gcs"
        status["bucket_name"] = settings.GCP_BUCKET_NAME
        status["configured"] = True
        try:
            client, bucket = get_gcs_client()
            if client and bucket and bucket.exists():
                status["accessible"] = True
            else:
                status["error"] = "Could not connect to GCS bucket"
        except Exception as e:
            status["error"] = str(e)
    
    # Check Azure
    elif settings.AZURE_STORAGE_CONNECTION_STRING or settings.AZURE_STORAGE_ACCOUNT_NAME:
        status["provider"] = "azure"
        status["bucket_name"] = settings.AZURE_STORAGE_CONTAINER
        status["configured"] = True
        try:
            if USE_PROVIDER_ABSTRACTION:
                provider = get_storage_provider()
                status["accessible"] = provider is not None
            else:
                status["error"] = "Provider abstraction not available"
        except Exception as e:
            status["error"] = str(e)
    else:
        status["error"] = "No cloud storage configured"
    
    return status


def get_gcs_client():
    """Get or create GCS client singleton (fallback method)"""
    global _gcs_client, _gcs_bucket
    
    if _gcs_client is None:
        try:
            from google.cloud import storage
            from google.oauth2 import service_account
            
            # Check for credentials file
            creds_path = settings.GCP_CREDENTIALS_PATH
            
            # Try to resolve relative paths
            if creds_path:
                # Try as-is first
                if not os.path.exists(creds_path):
                    # Try relative to backend directory
                    backend_dir = Path(__file__).parent.parent
                    potential_path = backend_dir / creds_path
                    if potential_path.exists():
                        creds_path = str(potential_path)
                    else:
                        # Try relative to project root
                        project_root = backend_dir.parent
                        potential_path = project_root / creds_path.lstrip('../')
                        if potential_path.exists():
                            creds_path = str(potential_path)
            
            if creds_path and os.path.exists(creds_path):
                credentials = service_account.Credentials.from_service_account_file(creds_path)
                _gcs_client = storage.Client(
                    project=settings.GCP_PROJECT_ID,
                    credentials=credentials
                )
                logger.info(f"GCS client initialized with credentials from {creds_path}")
            else:
                # Try default credentials (for GCP environments)
                _gcs_client = storage.Client(project=settings.GCP_PROJECT_ID)
                logger.info("GCS client initialized with default credentials")
            
            # Get bucket
            _gcs_bucket = _gcs_client.bucket(settings.GCP_BUCKET_NAME)
            
            # Verify bucket exists
            if not _gcs_bucket.exists():
                logger.warning(f"Bucket {settings.GCP_BUCKET_NAME} does not exist. Creating...")
                _gcs_bucket.create(location="us-central1")
                logger.info(f"Bucket {settings.GCP_BUCKET_NAME} created successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize GCS client: {e}")
            _gcs_client = None
            _gcs_bucket = None
    
    return _gcs_client, _gcs_bucket


def upload_to_gcs(
    file_path: Path,
    claim_id: str,
    original_filename: str,
    content_type: Optional[str] = None,
    tenant_id: Optional[str] = None
) -> Tuple[Optional[str], Optional[str]]:
    """
    Upload a file to cloud storage (uses configured provider)
    
    Args:
        file_path: Local path to the file
        claim_id: Claim ID for organizing files
        original_filename: Original filename from upload
        content_type: MIME type of the file
        tenant_id: Tenant ID for multi-tenant folder organization
    
    Returns:
        Tuple of (storage_path, blob_name) or (None, None) on failure
    """
    # Use provider abstraction if available
    if USE_PROVIDER_ABSTRACTION:
        try:
            provider = get_storage_provider()
            return provider.upload_file(file_path, claim_id, original_filename, content_type)
        except Exception as e:
            logger.error(f"Provider upload failed, trying direct GCS: {e}")
    
    # Direct GCS implementation (fallback)
    client, bucket = get_gcs_client()
    
    if not client or not bucket:
        logger.error("GCS client not available, falling back to local storage")
        return None, None
    
    try:
        # Generate unique blob name with tenant-based folder structure
        file_extension = Path(original_filename).suffix.lower()
        unique_filename = f"{uuid4()}{file_extension}"
        
        # Organize by tenant if provided
        if tenant_id:
            blob_name = f"tenants/{tenant_id}/claims/{claim_id}/documents/{unique_filename}"
        else:
            blob_name = f"claims/{claim_id}/documents/{unique_filename}"
        
        # Create blob and upload
        blob = bucket.blob(blob_name)
        
        # Set content type
        if content_type:
            blob.content_type = content_type
        
        # Upload file
        blob.upload_from_filename(str(file_path))
        
        logger.info(f"File uploaded to GCS: gs://{settings.GCP_BUCKET_NAME}/{blob_name}")
        
        # Return the GCS path (not public URL for security)
        gcs_path = f"gs://{settings.GCP_BUCKET_NAME}/{blob_name}"
        
        return gcs_path, blob_name
        
    except Exception as e:
        logger.error(f"Failed to upload file to GCS: {e}")
        return None, None


def upload_avatar_to_cloud(
    file_content: bytes,
    user_id: str,
    original_filename: str,
    content_type: Optional[str] = None,
    tenant_id: Optional[str] = None
) -> Tuple[Optional[str], Optional[str]]:
    """
    Upload user avatar/profile picture to cloud storage.
    
    Args:
        file_content: File content as bytes
        user_id: User ID for organizing files
        original_filename: Original filename from upload
        content_type: MIME type of the file
        tenant_id: Tenant ID for multi-tenant folder organization
    
    Returns:
        Tuple of (storage_path, blob_name) or (None, None) on failure
    """
    if not is_cloud_storage_configured():
        logger.error("Cloud storage not configured - avatar upload not available")
        return None, None
    
    # Always use direct GCS implementation for avatars to ensure correct folder structure
    # The provider abstraction uses claims/ folder which is not appropriate for avatars
    client, bucket = get_gcs_client()
    
    if not client or not bucket:
        logger.error("GCS client not available for avatar upload")
        return None, None
    
    try:
        # Generate unique blob name for avatars with tenant folder
        file_extension = Path(original_filename).suffix.lower()
        unique_filename = f"{uuid4()}{file_extension}"
        
        # Organize by tenant if provided
        if tenant_id:
            blob_name = f"tenants/{tenant_id}/avatars/{user_id}/{unique_filename}"
        else:
            blob_name = f"avatars/{user_id}/{unique_filename}"
        
        # Create blob and upload
        blob = bucket.blob(blob_name)
        
        # Set content type
        if content_type:
            blob.content_type = content_type
        
        # Upload from bytes
        blob.upload_from_string(file_content, content_type=content_type)
        
        logger.info(f"Avatar uploaded to GCS: gs://{settings.GCP_BUCKET_NAME}/{blob_name}")
        
        # Return the GCS path
        gcs_path = f"gs://{settings.GCP_BUCKET_NAME}/{blob_name}"
        
        return gcs_path, blob_name
        
    except Exception as e:
        logger.error(f"Failed to upload avatar to GCS: {e}")
        return None, None


def upload_bytes_to_gcs(
    file_content: bytes,
    claim_id: str,
    original_filename: str,
    content_type: Optional[str] = None,
    tenant_id: Optional[str] = None
) -> Tuple[Optional[str], Optional[str]]:
    """
    Upload file bytes directly to cloud storage (uses configured provider)
    
    Args:
        file_content: File content as bytes
        claim_id: Claim ID for organizing files
        original_filename: Original filename from upload
        content_type: MIME type of the file
        tenant_id: Tenant ID for multi-tenant folder organization
    
    Returns:
        Tuple of (storage_path, blob_name) or (None, None) on failure
    """
    # Use provider abstraction if available
    if USE_PROVIDER_ABSTRACTION:
        try:
            provider = get_storage_provider()
            return provider.upload_bytes(file_content, claim_id, original_filename, content_type)
        except Exception as e:
            logger.error(f"Provider upload_bytes failed, trying direct GCS: {e}")
    
    # Direct GCS implementation (fallback)
    client, bucket = get_gcs_client()
    
    if not client or not bucket:
        logger.error("GCS client not available")
        return None, None
    
    try:
        # Generate unique blob name with tenant-based folder structure
        file_extension = Path(original_filename).suffix.lower()
        unique_filename = f"{uuid4()}{file_extension}"
        
        # Organize by tenant if provided
        if tenant_id:
            blob_name = f"tenants/{tenant_id}/claims/{claim_id}/documents/{unique_filename}"
        else:
            blob_name = f"claims/{claim_id}/documents/{unique_filename}"
        
        # Create blob and upload
        blob = bucket.blob(blob_name)
        
        # Set content type
        if content_type:
            blob.content_type = content_type
        
        # Upload from bytes
        blob.upload_from_string(file_content, content_type=content_type)
        
        logger.info(f"File uploaded to GCS: gs://{settings.GCP_BUCKET_NAME}/{blob_name}")
        
        # Return the GCS path
        gcs_path = f"gs://{settings.GCP_BUCKET_NAME}/{blob_name}"
        
        return gcs_path, blob_name
        
    except Exception as e:
        logger.error(f"Failed to upload bytes to GCS: {e}")
        return None, None


def get_signed_url(blob_name: str, expiration_minutes: int = 60) -> Optional[str]:
    """
    Generate a signed URL for temporary access to a file
    
    Args:
        blob_name: The blob name (path within bucket)
        expiration_minutes: URL expiration time in minutes
    
    Returns:
        Signed URL string or None on failure
    """
    # Use provider abstraction if available
    if USE_PROVIDER_ABSTRACTION:
        try:
            provider = get_storage_provider()
            return provider.get_signed_url(blob_name, expiration_minutes)
        except Exception as e:
            logger.error(f"Provider get_signed_url failed, trying direct GCS: {e}")
    
    # Direct GCS implementation (fallback)
    client, bucket = get_gcs_client()
    
    if not client or not bucket:
        logger.error("GCS client not available")
        return None
    
    try:
        blob = bucket.blob(blob_name)
        
        # Check if blob exists
        if not blob.exists():
            logger.warning(f"Blob does not exist: {blob_name}")
            return None
        
        # Generate signed URL
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiration_minutes),
            method="GET"
        )
        
        logger.info(f"Generated signed URL for {blob_name}, expires in {expiration_minutes} minutes")
        return url
        
    except Exception as e:
        logger.error(f"Failed to generate signed URL: {e}")
        return None


def download_from_gcs(blob_name: str, destination_path: Path) -> bool:
    """
    Download a file from cloud storage to local path
    
    Args:
        blob_name: The blob name (path within bucket)
        destination_path: Local path to save the file
    
    Returns:
        True on success, False on failure
    """
    # Use provider abstraction if available
    if USE_PROVIDER_ABSTRACTION:
        try:
            provider = get_storage_provider()
            return provider.download(blob_name, destination_path)
        except Exception as e:
            logger.error(f"Provider download failed, trying direct GCS: {e}")
    
    # Direct GCS implementation (fallback)
    client, bucket = get_gcs_client()
    
    if not client or not bucket:
        logger.error("GCS client not available")
        return False
    
    try:
        blob = bucket.blob(blob_name)
        
        # Download
        blob.download_to_filename(str(destination_path))
        
        logger.info(f"File downloaded from GCS: {blob_name} -> {destination_path}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to download file from GCS: {e}")
        return False


def delete_from_gcs(blob_name: str) -> bool:
    """
    Delete a file from cloud storage
    
    Args:
        blob_name: The blob name (path within bucket)
    
    Returns:
        True on success, False on failure
    """
    # Use provider abstraction if available
    if USE_PROVIDER_ABSTRACTION:
        try:
            provider = get_storage_provider()
            return provider.delete(blob_name)
        except Exception as e:
            logger.error(f"Provider delete failed, trying direct GCS: {e}")
    
    # Direct GCS implementation (fallback)
    client, bucket = get_gcs_client()
    
    if not client or not bucket:
        logger.error("GCS client not available")
        return False
    
    try:
        blob = bucket.blob(blob_name)
        
        if blob.exists():
            blob.delete()
            logger.info(f"File deleted from GCS: {blob_name}")
            return True
        else:
            logger.warning(f"Blob does not exist for deletion: {blob_name}")
            return True  # Consider non-existent as success
        
    except Exception as e:
        logger.error(f"Failed to delete file from GCS: {e}")
        return False


def get_blob_metadata(blob_name: str) -> Optional[dict]:
    """
    Get metadata for a blob in cloud storage
    
    Args:
        blob_name: The blob name (path within bucket)
    
    Returns:
        Dict with blob metadata or None on failure
    """
    # Use provider abstraction if available
    if USE_PROVIDER_ABSTRACTION:
        try:
            provider = get_storage_provider()
            return provider.get_metadata(blob_name)
        except Exception as e:
            logger.error(f"Provider get_metadata failed, trying direct GCS: {e}")
    
    # Direct GCS implementation (fallback)
    client, bucket = get_gcs_client()
    
    if not client or not bucket:
        return None
    
    try:
        blob = bucket.blob(blob_name)
        
        if not blob.exists():
            return None
        
        blob.reload()
        
        return {
            "name": blob.name,
            "size": blob.size,
            "content_type": blob.content_type,
            "created": blob.time_created,
            "updated": blob.updated,
            "md5_hash": blob.md5_hash,
        }
        
    except Exception as e:
        logger.error(f"Failed to get blob metadata: {e}")
        return None


def upload_branding_to_cloud(
    file_content: bytes,
    tenant_id: str,
    file_type: str,
    original_filename: str,
    content_type: Optional[str] = None
) -> Tuple[Optional[str], Optional[str]]:
    """
    Upload branding file (logo, favicon, etc.) to cloud storage.
    
    Args:
        file_content: File content as bytes
        tenant_id: Tenant ID for organizing files
        file_type: Type of branding file (logo, logo_mark, favicon, login_background)
        original_filename: Original filename from upload
        content_type: MIME type of the file
    
    Returns:
        Tuple of (public_url, blob_name) or (None, None) on failure
    """
    if not is_cloud_storage_configured():
        logger.warning("Cloud storage not configured - branding upload will use local storage")
        return None, None
    
    client, bucket = get_gcs_client()
    
    if not client or not bucket:
        logger.error("GCS client not available for branding upload")
        return None, None
    
    try:
        # Generate unique blob name for branding files
        file_extension = Path(original_filename).suffix.lower()
        unique_id = str(uuid4())[:8]
        unique_filename = f"{file_type}_{unique_id}{file_extension}"
        
        # Organize under tenant's branding folder
        blob_name = f"tenants/{tenant_id}/branding/{unique_filename}"
        
        # Create blob and upload
        blob = bucket.blob(blob_name)
        
        # Set content type
        if content_type:
            blob.content_type = content_type
        
        # Upload from bytes
        blob.upload_from_string(file_content, content_type=content_type)
        
        # Make the blob publicly readable (branding assets need to be public)
        blob.make_public()
        
        logger.info(f"Branding file uploaded to GCS: gs://{settings.GCP_BUCKET_NAME}/{blob_name}")
        
        # Return the public URL and blob name
        public_url = blob.public_url
        
        return public_url, blob_name
        
    except Exception as e:
        logger.error(f"Failed to upload branding to GCS: {e}")
        return None, None


def delete_branding_from_cloud(blob_name: str) -> bool:
    """
    Delete a branding file from cloud storage.
    
    Args:
        blob_name: The blob name (path within bucket)
    
    Returns:
        True on success, False on failure
    """
    if not blob_name:
        return True
    
    if not is_cloud_storage_configured():
        logger.warning("Cloud storage not configured - cannot delete from cloud")
        return False
    
    client, bucket = get_gcs_client()
    
    if not client or not bucket:
        logger.error("GCS client not available")
        return False
    
    try:
        blob = bucket.blob(blob_name)
        
        if blob.exists():
            blob.delete()
            logger.info(f"Deleted branding file from GCS: {blob_name}")
        else:
            logger.warning(f"Branding blob does not exist: {blob_name}")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to delete branding from GCS: {e}")
        return False

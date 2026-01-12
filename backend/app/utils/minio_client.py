from minio import Minio
from minio.error import S3Error
from io import BytesIO
from app.config import settings
import tempfile
import os
import logging
from datetime import timedelta

logger = logging.getLogger(__name__)

class MinIOClient:
    def __init__(self):
        self.client = Minio(
            f"{settings.minio_endpoint}:{settings.minio_port}",
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_use_ssl
        )
        self.bucket_name = settings.minio_bucket
        self._initialize_bucket()
    
    def _initialize_bucket(self):
        """Initialize bucket if it doesn't exist"""
        try:
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
                logger.info(f"Created MinIO bucket: {self.bucket_name}")
        except S3Error as e:
            logger.error(f"Error initializing MinIO bucket: {e}")
    
    def upload_file(self, file_data: bytes, file_path: str, content_type: str = "application/octet-stream") -> bool:
        """Upload file to MinIO"""
        try:
            file_stream = BytesIO(file_data)
            self.client.put_object(
                self.bucket_name,
                file_path,
                file_stream,
                len(file_data),
                content_type=content_type
            )
            logger.info(f"Uploaded file to MinIO: {file_path}")
            return True
        except S3Error as e:
            logger.error(f"Error uploading file to MinIO: {e}")
            return False
    
    def download_file(self, file_path: str) -> bytes:
        """Download file from MinIO"""
        try:
            response = self.client.get_object(self.bucket_name, file_path)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            logger.error(f"Error downloading file from MinIO: {e}")
            return b""
    
    def download_file_to_temp(self, file_path: str) -> str:
        """Download file from MinIO to a temporary file and return the path"""
        try:
            # Get file extension
            _, ext = os.path.splitext(file_path)
            
            # Create temporary file
            temp_fd, temp_path = tempfile.mkstemp(suffix=ext)
            
            # Download file data
            file_data = self.download_file(file_path)
            if not file_data:
                os.close(temp_fd)
                os.unlink(temp_path)
                return None
            
            # Write to temporary file
            with os.fdopen(temp_fd, 'wb') as temp_file:
                temp_file.write(file_data)
            
            logger.info(f"Downloaded file to temporary path: {temp_path}")
            return temp_path
            
        except Exception as e:
            logger.error(f"Error downloading file to temp: {e}")
            return None
    
    def delete_file(self, file_path: str) -> bool:
        """Delete file from MinIO"""
        try:
            self.client.remove_object(self.bucket_name, file_path)
            logger.info(f"Deleted file from MinIO: {file_path}")
            return True
        except S3Error as e:
            logger.error(f"Error deleting file from MinIO: {e}")
            return False
    
    def file_exists(self, file_path: str) -> bool:
        """Check if file exists in MinIO"""
        try:
            self.client.stat_object(self.bucket_name, file_path)
            return True
        except S3Error:
            return False
    
    def get_file_url(self, file_path: str, expires_in_seconds: int = 3600) -> str:
        """Get presigned URL for file"""
        try:
            # For PDF viewing, we want inline display
            response_headers = {
                'response-content-disposition': 'inline',
                'response-content-type': 'application/pdf'
            }
            
            url = self.client.presigned_get_object(
                self.bucket_name, 
                file_path, 
                expires=timedelta(seconds=expires_in_seconds),
                response_headers=response_headers
            )
            return url
        except S3Error as e:
            logger.error(f"Error generating presigned URL: {e}")
            return ""

# Global instance
minio_client = MinIOClient()

# Legacy constants and functions for backward compatibility
BUCKET_NAME = minio_client.bucket_name

def upload_file(file_data: bytes, file_path: str, content_type: str = "application/octet-stream"):
    """Upload file to MinIO (legacy function)"""
    return minio_client.upload_file(file_data, file_path, content_type)


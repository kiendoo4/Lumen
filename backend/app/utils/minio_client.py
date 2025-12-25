from minio import Minio
from minio.error import S3Error
from io import BytesIO
from app.config import settings

minio_client = Minio(
    f"{settings.minio_endpoint}:{settings.minio_port}",
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=settings.minio_use_ssl
)

BUCKET_NAME = settings.minio_bucket

# Initialize bucket
try:
    if not minio_client.bucket_exists(BUCKET_NAME):
        minio_client.make_bucket(BUCKET_NAME)
except S3Error as e:
    print(f"Error initializing MinIO bucket: {e}")

def upload_file(file_data: bytes, file_path: str, content_type: str = "application/octet-stream"):
    """Upload file to MinIO"""
    file_stream = BytesIO(file_data)
    minio_client.put_object(
        BUCKET_NAME,
        file_path,
        file_stream,
        len(file_data),
        content_type=content_type
    )


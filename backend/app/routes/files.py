from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.utils.minio_client import minio_client, BUCKET_NAME
from minio.error import S3Error
from io import BytesIO

router = APIRouter()

@router.get("/{file_path:path}")
async def get_file(file_path: str):
    try:
        response = minio_client.get_object(BUCKET_NAME, file_path)
        data = response.read()
        response.close()
        response.release_conn()
        
        # Try to determine content type
        content_type = "application/octet-stream"
        if file_path.endswith('.pdf'):
            content_type = 'application/pdf'
        elif file_path.endswith(('.jpg', '.jpeg')):
            content_type = 'image/jpeg'
        elif file_path.endswith('.png'):
            content_type = 'image/png'
        
        return StreamingResponse(
            BytesIO(data),
            media_type=content_type
        )
    except S3Error as e:
        raise HTTPException(status_code=404, detail="File not found")

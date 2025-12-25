import { Client } from 'minio';
import dotenv from 'dotenv';

dotenv.config();

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123'
});

const BUCKET_NAME = 'research-agent-files';

// Initialize bucket if it doesn't exist
minioClient.bucketExists(BUCKET_NAME)
  .then(exists => {
    if (!exists) {
      return minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
    }
  })
  .catch(err => {
    console.error('Error initializing MinIO bucket:', err);
  });

export { minioClient, BUCKET_NAME };



import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// -- Configuration -----------------------------------------------------------

function getStorageConfig() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const bucketName = process.env.S3_BUCKET;
  const region = process.env.S3_REGION ?? 'us-east-1';

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      'Missing S3 configuration. Required environment variables: ' +
        'S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET',
    );
  }

  return { endpoint, accessKeyId, secretAccessKey, bucketName, region };
}

// -- Singleton Client --------------------------------------------------------

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const config = getStorageConfig();

    s3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  return s3Client;
}

// -- Presigned Upload URL ----------------------------------------------------

/**
 * Generate a presigned PUT URL for uploading an object to S3.
 *
 * @param key - The object key (path) in the bucket
 * @param contentType - The MIME type of the file being uploaded
 * @param maxSizeBytes - Maximum file size in bytes
 * @param expiresIn - URL expiry time in seconds (default: 3600 = 1 hour)
 * @returns Presigned upload URL and the object key
 */
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  maxSizeBytes?: number,
  expiresIn: number = 3600,
): Promise<{ url: string; key: string }> {
  const config = getStorageConfig();
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: contentType,
    ...(maxSizeBytes ? { ContentLength: maxSizeBytes } : {}),
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return { url, key };
}

// -- Presigned Download URL --------------------------------------------------

/**
 * Generate a presigned GET URL for downloading an object from S3.
 *
 * @param key - The object key (path) in the bucket
 * @param expiresIn - URL expiry time in seconds (default: 3600 = 1 hour)
 * @returns Presigned download URL
 */
export async function generatePresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600,
): Promise<string> {
  const config = getStorageConfig();
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

// -- Delete Object -----------------------------------------------------------

/**
 * Delete an object from S3.
 *
 * @param key - The object key (path) in the bucket
 */
export async function deleteStorageObject(key: string): Promise<void> {
  const config = getStorageConfig();
  const client = getS3Client();

  const command = new DeleteObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  await client.send(command);
}

// -- Utility -----------------------------------------------------------------

/**
 * Build a storage key for user media files.
 */
export function buildMediaKey(
  userId: string,
  filename: string,
  folder: string = 'originals',
): string {
  const timestamp = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `users/${userId}/media/${folder}/${timestamp}_${sanitized}`;
}

/**
 * Build a storage key for user avatars.
 */
export function buildAvatarKey(userId: string, extension: string): string {
  const timestamp = Date.now();
  return `users/${userId}/avatar/${timestamp}.${extension}`;
}

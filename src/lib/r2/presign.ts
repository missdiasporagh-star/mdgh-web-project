import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function presignR2Put(args: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  key: string;
  contentType: string;
  expiresInSeconds: number;
}): Promise<string> {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${args.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: args.accessKeyId, secretAccessKey: args.secretAccessKey },
  });
  const command = new PutObjectCommand({
    Bucket: args.bucket,
    Key: args.key,
    ContentType: args.contentType,
    ContentDisposition: 'attachment',
  });
  return getSignedUrl(client, command, { expiresIn: args.expiresInSeconds });
}

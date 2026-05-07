import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function presignR2Get(args: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  key: string;
  expiresInSeconds: number;
}): Promise<string> {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${args.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: args.accessKeyId, secretAccessKey: args.secretAccessKey },
  });
  return getSignedUrl(client, new GetObjectCommand({ Bucket: args.bucket, Key: args.key }), {
    expiresIn: args.expiresInSeconds,
  });
}

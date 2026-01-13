import { Injectable } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private _client?: S3Client;
  private _bucket?: string;

  private ensureClient() {
    const region = process.env.AWS_REGION;
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!region || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error('Missing S3 configuration');
    }

    if (!this._client) {
      this._bucket = bucket;
      this._client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
    }
  }

  async uploadBuffer(params: { key: string; body: Buffer; contentType: string }) {
    this.ensureClient();
    const command = new PutObjectCommand({
      Bucket: this._bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    });
    await this._client?.send(command);
  }

  async getSignedUrl(params: { key: string; expiresInSeconds: number }) {
    this.ensureClient();
    const command = new GetObjectCommand({
      Bucket: this._bucket,
      Key: params.key,
    });
    return getSignedUrl(this._client as S3Client, command, {
      expiresIn: params.expiresInSeconds,
    });
  }
}

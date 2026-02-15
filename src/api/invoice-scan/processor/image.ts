import sharp from 'sharp';

export async function downloadImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image download failed: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function preprocessImageForVision(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: 1800, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.1 })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

export function toDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

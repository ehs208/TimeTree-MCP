import { TIMETREE_CONFIG } from '../config/config.js';
import { HttpError } from './http-client.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Download without the API client's cookies or CSRF token, including on redirects. */
export async function downloadCommentImage(objectKey: string): Promise<{ data: Buffer; mimeType: string }> {
  const url = new URL(TIMETREE_CONFIG.ATTACHMENT_BASE_URL);
  // Setting only the pathname keeps even a malformed object key on the fixed host.
  url.pathname = objectKey;

  try {
    const response = await fetch(url, {
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new HttpError(response.status, `Image download failed (HTTP ${response.status}).`);
    }
    if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) {
      await response.body?.cancel();
      throw new HttpError(413, 'Comment images must be no larger than 5 MiB.');
    }
    if (!response.body) throw new HttpError(415, 'The comment image is empty.');

    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > MAX_IMAGE_BYTES) {
        throw new HttpError(413, 'Comment images must be no larger than 5 MiB.');
      }
      chunks.push(chunk);
    }
    const data = Buffer.concat(chunks, size);
    // Identify bytes rather than trusting a filename or a CDN Content-Type header.
    let mimeType: string;
    if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      mimeType = 'image/png';
    } else if (data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) {
      mimeType = 'image/jpeg';
    } else if (['GIF87a', 'GIF89a'].includes(data.subarray(0, 6).toString('latin1'))) {
      mimeType = 'image/gif';
    } else if (data.subarray(0, 4).toString('latin1') === 'RIFF' && data.subarray(8, 12).toString('latin1') === 'WEBP') {
      mimeType = 'image/webp';
    } else {
      throw new HttpError(415, 'Unsupported comment image. Supported formats: JPEG, PNG, GIF, WebP.');
    }
    return { data, mimeType };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    // Fetch errors can contain private object keys or response details.
    throw new Error('Could not download the comment image. The request failed, timed out, or was redirected.');
  }
}

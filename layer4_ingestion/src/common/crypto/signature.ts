import { createHmac, timingSafeEqual } from 'crypto';

export function hmacSha256Hex(secret: string, payload: string) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

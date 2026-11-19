import crypto from 'node:crypto';
import { Router, type Response } from 'express';
import { requireAuth, requireDatabase, type AuthRequest } from '../auth.ts';
import { dbRateLimit } from '../rateLimit.ts';

const mediaRouter = Router();

const MAX_BYTES = 5 * 1024 * 1024; // 5MB strict limit per Spec Section 2
const ALLOWED_MIME_PREFIXES = ['data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,'];

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

// POST /api/media/upload - Upload avatar or crate cover image to Cloudinary (max 5MB)
mediaRouter.post(
  '/media/upload',
  requireDatabase,
  requireAuth,
  dbRateLimit({ action: 'media_upload', maxRequests: 15, windowSeconds: 600 }),
  async (req: AuthRequest, res: Response) => {
    const { dataUrl, folder } = req.body ?? {};
    if (typeof dataUrl !== 'string' || !ALLOWED_MIME_PREFIXES.some((p) => dataUrl.startsWith(p))) {
      return res.status(400).json({
        error: 'Only JPEG, PNG, or WebP images are supported for avatars and crate covers.',
      });
    }

    const base64Part = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const approxBytes = Math.ceil((base64Part.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      return res.status(413).json({
        error: 'Image exceeds the 5MB maximum size limit.',
      });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        error:
          'Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are not configured. You can paste an https:// image URL instead.',
      });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME!.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY!.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET!.trim();
    const targetFolder = folder === 'crate-covers' ? 'sona/crate-covers' : 'sona/avatars';
    const timestamp = Math.floor(Date.now() / 1000);

    // Cloudinary SHA-1 signature over sorted params
    const signaturePayload = `folder=${targetFolder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto
      .createHash('sha1')
      .update(signaturePayload)
      .digest('hex');

    try {
      const form = new FormData();
      form.append('file', dataUrl);
      form.append('api_key', apiKey);
      form.append('timestamp', String(timestamp));
      form.append('folder', targetFolder);
      form.append('signature', signature);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
        {
          method: 'POST',
          body: form,
        },
      );
      const payload = (await uploadRes.json().catch(() => ({}))) as {
        secure_url?: string;
        error?: { message?: string };
      };

      if (!uploadRes.ok || !payload.secure_url) {
        return res.status(502).json({
          error: payload?.error?.message || 'Cloudinary upload failed.',
        });
      }

      return res.status(201).json({
        url: payload.secure_url,
      });
    } catch {
      return res.status(502).json({
        error: 'Network error uploading image to Cloudinary.',
      });
    }
  },
);

export default mediaRouter;

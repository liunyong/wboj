import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

const buildPublicBaseUrl = (req) => {
  const configured = process.env.PUBLIC_UPLOAD_BASE_URL;
  if (configured && configured.trim()) {
    return configured.trim().replace(/\/*$/, '');
  }

  const origin = req.get('origin');
  if (origin) {
    return origin.replace(/\/*$/, '');
  }

  const forwardedProto = req.get('x-forwarded-proto');
  const forwardedHost = req.get('x-forwarded-host');
  const host = forwardedHost || req.get('host');
  const protocol = forwardedProto || req.protocol || 'http';
  if (!host) {
    return '';
  }
  return `${protocol}://${host}`.replace(/\/*$/, '');
};

const MAX_DIMENSION = 4096;
const UPLOAD_ROOT = path.resolve('uploads');
const PROBLEM_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'problems');

const formatMap = {
  png: { ext: 'png', mime: 'image/png' },
  jpeg: { ext: 'jpg', mime: 'image/jpeg' },
  jpg: { ext: 'jpg', mime: 'image/jpeg' },
  webp: { ext: 'webp', mime: 'image/webp' },
  avif: { ext: 'avif', mime: 'image/avif' },
  heif: { ext: 'avif', mime: 'image/avif' }
};

const ensureUploadDir = async () => {
  await fs.mkdir(PROBLEM_UPLOAD_DIR, { recursive: true });
};

const listProblemImageFiles = async () => {
  try {
    const entries = await fs.readdir(PROBLEM_UPLOAD_DIR, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const getImageMetadata = async (filename) => {
  const filePath = path.join(PROBLEM_UPLOAD_DIR, filename);
  const stats = await fs.stat(filePath);
  return {
    name: filename,
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    createdAt: stats.birthtime.toISOString()
  };
};

const detectImageFormat = (buffer = Buffer.alloc(0)) => {
  if (buffer.length >= 8) {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.subarray(0, 8).equals(pngSignature)) {
      return formatMap.png;
    }
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return formatMap.jpeg;
  }

  if (buffer.length >= 12) {
    const riffHeader = buffer.toString('ascii', 0, 4);
    const webpHeader = buffer.toString('ascii', 8, 12);
    if (riffHeader === 'RIFF' && webpHeader === 'WEBP') {
      return formatMap.webp;
    }
  }

  if (buffer.length >= 12) {
    const brand = buffer.toString('ascii', 8, 12).toLowerCase();
    const boxType = buffer.toString('ascii', 4, 8);
    if (boxType === 'ftyp' && (brand.startsWith('avif') || brand.startsWith('avis'))) {
      return formatMap.avif;
    }
  }

  return null;
};

export const uploadProblemImage = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    const { buffer } = req.file;
    if (!buffer.length) {
      return res.status(400).json({ message: 'Image file is empty' });
    }

    const detected = detectImageFormat(buffer);
    if (!detected) {
      return res.status(415).json({ message: 'Unsupported image format' });
    }

    const sharpInstance = sharp(buffer, { failOnError: true }).rotate();
    const metadata = await sharpInstance.metadata();

    let pipeline = sharpInstance;
    if (
      (metadata.width && metadata.width > MAX_DIMENSION) ||
      (metadata.height && metadata.height > MAX_DIMENSION)
    ) {
      pipeline = pipeline.resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    const resultFormat = formatMap[info.format] ?? detected;

    await ensureUploadDir();

    const filename = `${randomUUID()}.${resultFormat.ext}`;
    const filepath = path.join(PROBLEM_UPLOAD_DIR, filename);

    await fs.writeFile(filepath, data);

    const relativeUrl = `/uploads/problems/${filename}`;
    const apiRelativeUrl = `/api/uploads/problems/${filename}`;
    const baseUrl = buildPublicBaseUrl(req);
    const absoluteUrl = baseUrl ? new URL(relativeUrl, `${baseUrl}/`).toString() : relativeUrl;

    res.status(201).json({
      url: absoluteUrl,
      path: relativeUrl,
      apiPath: apiRelativeUrl
    });
  } catch (error) {
    if (error?.message?.includes?.('Input buffer contains unsupported image format')) {
      return res.status(415).json({ message: 'Unsupported image format' });
    }
    next(error);
  }
};

export default uploadProblemImage;

export const listProblemImages = async (req, res, next) => {
  try {
    const files = await listProblemImageFiles();
    if (!files.length) {
      return res.json({ items: [] });
    }

    const baseUrl = buildPublicBaseUrl(req);
    const images = await Promise.all(
      files.map(async (filename) => {
        const meta = await getImageMetadata(filename);
        const relativeUrl = `/uploads/problems/${filename}`;
        const apiUrl = `/api/uploads/problems/${filename}`;
        const url = baseUrl ? new URL(relativeUrl, `${baseUrl}/`).toString() : relativeUrl;
        return {
          ...meta,
          url,
          apiPath: apiUrl,
          path: relativeUrl
        };
      })
    );

    images.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

    res.json({ items: images });
  } catch (error) {
    next(error);
  }
};

export const deleteProblemImage = async (req, res, next) => {
  try {
    const { filename } = req.params;
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ message: 'Filename is required' });
    }

    const safePath = path.resolve(PROBLEM_UPLOAD_DIR, filename);
    if (!safePath.startsWith(PROBLEM_UPLOAD_DIR)) {
      return res.status(400).json({ message: 'Invalid filename' });
    }

    await fs.unlink(safePath);
    res.status(204).send();
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ message: 'File not found' });
    }
    next(error);
  }
};

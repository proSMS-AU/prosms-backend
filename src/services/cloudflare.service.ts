import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";
import { v4 as uuid } from "uuid";
import mime from "mime-types";
import fs from "fs";
import { logger } from "../utils";
import { Response } from "express";
import { Readable } from "stream";

dotenv.config();

const REGION = "auto";
const ENDPOINT = process.env.R2_ENDPOINT;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET;
const PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

if (!ENDPOINT || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET || !PUBLIC_BASE_URL) {
  throw new Error("R2 configuration is incomplete (endpoint, keys, bucket, or public URL missing).");
}

const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY
  }
});

//  * Upload file buffer to R2 (for multer memory storage)
// async function uploadBufferToR2(
//   buffer: Buffer,
//   originalFileName: string,
//   folder: string = "uploads",
//   requireDownloadableUrl: boolean = false
// ) {
//   try {
//     const key = generateFileKeyForR2(originalFileName, folder);
//     const contentType = mime.lookup(originalFileName) || "application/octet-stream";

//     const params = {
//       Bucket: BUCKET,
//       Key: key,
//       Body: buffer,
//       ContentType: contentType,
//       ContentDisposition: requireDownloadableUrl ? "attachment" : "inline"
//     };

//     const result = await s3.send(new PutObjectCommand(params));

//     const publicUrl = `${PUBLIC_BASE_URL}/${key}`;

//     return {
//       success: true,
//       publicUrl,
//       key,
//       etag: result.ETag,
//       bucket: BUCKET
//     };
//   } catch (error) {
//     return {
//       success: false,
//       message: error instanceof Error ? error.message : "Unknown error from Cloudflare R2",
//       code: 500
//     };
//   }
// }

async function uploadBufferToR2(
  buffer: Buffer,
  originalFileName: string,
  folder: string = "uploads",
  requireDownloadableUrl: boolean = false,
  useOriginalName: boolean = false // new param
) {
  try {
    // use original name as-is for reports, generated key for user uploads
    const key = useOriginalName ? `${folder}/${originalFileName}` : generateFileKeyForR2(originalFileName, folder);

    const contentType = mime.lookup(originalFileName) || "application/octet-stream";

    const params = {
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentDisposition: requireDownloadableUrl ? "attachment" : "inline"
    };

    const result = await s3.send(new PutObjectCommand(params));
    const publicUrl = `${PUBLIC_BASE_URL}/${key}`;

    return {
      success: true,
      publicUrl,
      key,
      etag: result.ETag,
      bucket: BUCKET
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error from Cloudflare R2",
      code: 500
    };
  }
}

//  * Delete file from R2 by key
async function deleteFileFromR2(key: string) {
  try {
    const params = {
      Bucket: BUCKET,
      Key: key
    };

    await s3.send(new DeleteObjectCommand(params));

    return {
      success: true,
      message: `File deleted successfully: ${key}`
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete file from R2",
      code: 500
    };
  }
}

//  * Extract R2 key from public URL
function extractKeyFromUrl(publicUrl: string): string | null {
  try {
    // Remove the base URL to get the key
    // Example: https://pub-xxx.r2.dev/logos/123-uuid-logo.png → logos/123-uuid-logo.png
    if (!PUBLIC_BASE_URL) return null;

    const baseUrl = PUBLIC_BASE_URL.endsWith("/") ? PUBLIC_BASE_URL.slice(0, -1) : PUBLIC_BASE_URL;

    if (publicUrl.startsWith(baseUrl)) {
      return publicUrl.replace(baseUrl + "/", "");
    }

    return null;
  } catch (error) {
    logger.error("Failed to extract key from URL: ", error);
    return null;
  }
}

// * Generate unique file key for R2
function generateFileKeyForR2(originalFileName: string, folder: string = "uploads"): string {
  const ext = path.extname(originalFileName);
  const nameWithoutExt = path.basename(originalFileName, ext);
  const uniqueId = uuid();
  const timestamp = Date.now();

  const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, "-");
  return `${folder}/${timestamp}-${uniqueId}-${cleanName}${ext}`;
}

async function uploadFileR2WithAutoKey(
  filePath: string,
  folder: string = "uploads",
  requireDownloadableUrl: boolean = false
) {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        message: `File not found: ${filePath}`,
        code: 404
      };
    }

    // Read file into buffer
    const buffer = fs.readFileSync(filePath);
    const originalFileName = path.basename(filePath);

    return await uploadBufferToR2(buffer, originalFileName, folder, requireDownloadableUrl);
  } catch (error) {
    logger.error("Upload failed: ", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      code: 500
    };
  }
}

export const streamFromR2 = async (key: string, res: Response, download = false) => {
  const command = new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key });
  const r2 = await s3.send(command);

  // Infer content type from file extension
  const contentType = mime.lookup(key) || "application/octet-stream";
  const fileName = key.split("/").pop() || "download";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${fileName}"`);

  const body = r2.Body as Readable;
  body.pipe(res);
};

export const CloudflareService = {
  s3,
  uploadBufferToR2,
  deleteFileFromR2,
  extractKeyFromUrl,
  generateFileKeyForR2,
  uploadFileR2WithAutoKey
};

import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// Lazy initialization of object storage client to prevent startup failures
let _objectStorageClient: Storage | null = null;

// Get object storage client with error handling
export function getObjectStorageClient(): Storage | null {
  if (_objectStorageClient) {
    return _objectStorageClient;
  }

  try {
    _objectStorageClient = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: {
            type: "json",
            subject_token_field_name: "access_token",
          },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });
    return _objectStorageClient;
  } catch (error) {
    console.error("Failed to initialize object storage client:", error);
    return null;
  }
}

// Backward compatibility export
export const objectStorageClient = getObjectStorageClient();

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {}

  // Gets the public object search paths with error handling.
  getPublicObjectSearchPaths(): Array<string> {
    try {
      const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
      const paths = Array.from(
        new Set(
          pathsStr
            .split(",")
            .map((path) => path.trim())
            .filter((path) => path.length > 0)
        )
      );
      if (paths.length === 0) {
        console.warn(
          "PUBLIC_OBJECT_SEARCH_PATHS not set. Object storage functionality will be limited. " +
          "Create a bucket in 'Object Storage' tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
        );
        return [];
      }
      return paths;
    } catch (error) {
      console.error("Error getting public object search paths:", error);
      return [];
    }
  }

  // Gets the private object directory with error handling.
  getPrivateObjectDir(): string | null {
    try {
      const dir = process.env.PRIVATE_OBJECT_DIR || "";
      if (!dir) {
        console.warn(
          "PRIVATE_OBJECT_DIR not set. Private object functionality will be disabled. " +
          "Create a bucket in 'Object Storage' tool and set PRIVATE_OBJECT_DIR env var."
        );
        return null;
      }
      return dir;
    } catch (error) {
      console.error("Error getting private object directory:", error);
      return null;
    }
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<File | null> {
    const client = getObjectStorageClient();
    if (!client) {
      console.warn("Object storage client not available");
      return null;
    }

    const searchPaths = this.getPublicObjectSearchPaths();
    if (searchPaths.length === 0) {
      return null;
    }

    for (const searchPath of searchPaths) {
      try {
        const fullPath = `${searchPath}/${filePath}`;

        // Full path format: /<bucket_name>/<object_name>
        const { bucketName, objectName } = parseObjectPath(fullPath);
        const bucket = client.bucket(bucketName);
        const file = bucket.file(objectName);

        // Check if file exists
        const [exists] = await file.exists();
        if (exists) {
          return file;
        }
      } catch (error) {
        console.error(`Error searching for object ${filePath} in ${searchPath}:`, error);
        continue;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      // Get the ACL policy for the object.
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";
      // Set appropriate headers
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${
          isPublic ? "public" : "private"
        }, max-age=${cacheTtlSec}`,
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err: Error) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "Private object storage not configured. Upload functionality unavailable."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    try {
      const { bucketName, objectName } = parseObjectPath(fullPath);

      // Sign URL for PUT method with TTL
      return await signObjectURL({
        bucketName,
        objectName,
        method: "PUT",
        ttlSec: 900,
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      throw new Error("Failed to generate upload URL. Object storage may not be properly configured.");
    }
  }

  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const client = getObjectStorageClient();
    if (!client) {
      throw new Error("Object storage client not available");
    }

    let entityId = parts.slice(1).join("/");
    const entityDir = this.getPrivateObjectDir();
    if (!entityDir) {
      throw new Error("Private object storage not configured");
    }

    const normalizedEntityDir = !entityDir.endsWith("/") ? `${entityDir}/` : entityDir;
    
    // For legacy URLs like: replit-objstore-xxx/.private/uploads/id
    // We need to extract just the "uploads/id" part
    
    // Handle legacy format: "bucket/.private/uploads/id" -> "uploads/id"
    if (entityId.includes('/.private/')) {
      const privateIndex = entityId.indexOf('/.private/');
      entityId = entityId.substring(privateIndex + '/.private/'.length);
    }
    // Handle format: "bucket/uploads/id" -> "uploads/id" 
    else {
      const segments = entityId.split('/');
      // Remove bucket name if it's the first segment (starts with replit-objstore-)
      if (segments.length > 1 && segments[0].startsWith('replit-objstore-')) {
        segments.shift();
        entityId = segments.join('/');
      }
      
      // Remove .private prefix if it's at the start
      if (entityId.startsWith('.private/')) {
        entityId = entityId.slice('.private/'.length);
      }
    }
    
    // Remove any leading slashes
    entityId = entityId.replace(/^\/+/, '');
    
    const objectEntityPath = `${normalizedEntityDir}${entityId}`;
    
    try {
      const { bucketName, objectName } = parseObjectPath(objectEntityPath);
      const bucket = client.bucket(bucketName);
      const objectFile = bucket.file(objectName);
      const [exists] = await objectFile.exists();
      if (!exists) {
        throw new ObjectNotFoundError();
      }
      return objectFile;
    } catch (error) {
      console.error("Error getting object entity file:", error);
      throw new ObjectNotFoundError();
    }
  }

  normalizeObjectEntityPath(
    rawPath: string,
  ): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
  
    // Extract the path from the URL by removing query parameters and domain
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
  
    const objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir) {
      return rawObjectPath;
    }

    const normalizedEntityDir = !objectEntityDir.endsWith("/") ? `${objectEntityDir}/` : objectEntityDir;
  
    if (!rawObjectPath.startsWith(normalizedEntityDir)) {
      return rawObjectPath;
    }
  
    // Extract the entity ID from the path
    const entityId = rawObjectPath.slice(normalizedEntityDir.length);
    return `/objects/${entityId}`;
  }

  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    try {
      const normalizedPath = this.normalizeObjectEntityPath(rawPath);
      if (!normalizedPath.startsWith("/")) {
        return normalizedPath;
      }

      const objectFile = await this.getObjectEntityFile(normalizedPath);
      await setObjectAclPolicy(objectFile, aclPolicy);
      return normalizedPath;
    } catch (error) {
      console.error("Error setting object ACL policy:", error);
      return rawPath;
    }
  }

  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  try {
    const request = {
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    };
    
    const response = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Failed to sign object URL, status: ${response.status}, ` +
        `error: ${errorText}. Make sure you're running on Replit and object storage is configured.`
      );
    }

    const responseData = await response.json();
    if (!responseData.signed_url) {
      throw new Error("Invalid response from object storage service: missing signed_url");
    }

    return responseData.signed_url;
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error signing object URL:", error.message);
      throw error;
    } else {
      console.error("Unknown error signing object URL:", error);
      throw new Error("Failed to sign object URL due to an unknown error");
    }
  }
}
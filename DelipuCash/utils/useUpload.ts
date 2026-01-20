import * as React from "react";
import { UploadClient, UploadcareFile } from "@uploadcare/upload-client";

const client = new UploadClient({
  publicKey: process.env.EXPO_PUBLIC_UPLOADCARE_PUBLIC_KEY ?? "",
});

/**
 * React Native asset type (from image picker, document picker, etc.)
 */
export interface ReactNativeAsset {
  uri: string;
  name?: string;
  mimeType?: string;
  file?: Blob | File;
}

/**
 * Input type for uploading a React Native asset
 */
export interface ReactNativeAssetInput {
  reactNativeAsset: ReactNativeAsset;
}

/**
 * Input type for uploading from a URL
 */
export interface UrlInput {
  url: string;
}

/**
 * Input type for uploading a base64 encoded file
 */
export interface Base64Input {
  base64: string;
}

/**
 * Input type for uploading a raw buffer
 */
export interface BufferInput {
  buffer: Blob;
}

/**
 * Union type of all possible upload inputs
 */
export type UploadInput = ReactNativeAssetInput | UrlInput | Base64Input | BufferInput;

/**
 * Successful upload result
 */
export interface UploadSuccess {
  url: string;
  mimeType: string | null;
  error?: never;
}

/**
 * Failed upload result
 */
export interface UploadError {
  error: string;
  url?: never;
  mimeType?: never;
}

/**
 * Upload result type (success or error)
 */
export type UploadResult = UploadSuccess | UploadError;

/**
 * Upload function type
 */
export type UploadFn = (input: UploadInput) => Promise<UploadResult>;

/**
 * Upload state object
 */
export interface UploadState {
  loading: boolean;
}

/**
 * Return type of the useUpload hook
 */
export type UseUploadResult = [UploadFn, UploadState];

/**
 * Presign response from the API
 */
interface PresignResponse {
  secureSignature: string;
  secureExpire: string;
}

/**
 * Upload response from the API
 */
interface UploadResponse {
  url: string;
  mimeType?: string;
}

/**
 * Custom hook for file uploads
 * 
 * @description Provides a flexible upload function that supports multiple input types:
 * - React Native assets (from image/document pickers)
 * - URLs (for server-side URL fetching)
 * - Base64 encoded data
 * - Raw buffer data
 * 
 * Uses Uploadcare for presigned uploads when needed, with fallback to direct API uploads.
 * 
 * @returns Tuple containing the upload function and loading state
 * 
 * @example
 * ```tsx
 * function ImageUploader() {
 *   const [upload, { loading }] = useUpload();
 *   
 *   const handlePickImage = async () => {
 *     const result = await ImagePicker.launchImageLibraryAsync();
 *     if (!result.canceled) {
 *       const uploadResult = await upload({ 
 *         reactNativeAsset: result.assets[0] 
 *       });
 *       if ('error' in uploadResult) {
 *         console.error(uploadResult.error);
 *       } else {
 *         console.log('Uploaded:', uploadResult.url);
 *       }
 *     }
 *   };
 *   
 *   return (
 *     <Button onPress={handlePickImage} disabled={loading}>
 *       {loading ? 'Uploading...' : 'Pick Image'}
 *     </Button>
 *   );
 * }
 * ```
 */
function useUpload(): UseUploadResult {
  const [loading, setLoading] = React.useState<boolean>(false);

  const upload = React.useCallback(async (input: UploadInput): Promise<UploadResult> => {
    try {
      setLoading(true);
      let response: Response | undefined;

      if ("reactNativeAsset" in input && input.reactNativeAsset) {
        const asset = input.reactNativeAsset;

        if (asset.file) {
          const formData = new FormData();
          formData.append("file", asset.file);

          response = await fetch("/_create/api/upload/", {
            method: "POST",
            body: formData,
          });
        } else {
          // Fallback to presigned Uploadcare upload
          const presignRes = await fetch("/_create/api/upload/presign/", {
            method: "POST",
          });
          const { secureSignature, secureExpire }: PresignResponse = await presignRes.json();

          const result: UploadcareFile = await client.uploadFile(asset.uri, {
            fileName: asset.name ?? asset.uri.split("/").pop(),
            contentType: asset.mimeType,
            secureSignature,
            secureExpire,
          });

          return {
            url: `${process.env.EXPO_PUBLIC_BASE_CREATE_USER_CONTENT_URL}/${result.uuid}/`,
            mimeType: result.mimeType || null,
          };
        }
      } else if ("url" in input) {
        response = await fetch("/_create/api/upload/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: input.url }),
        });
      } else if ("base64" in input) {
        response = await fetch("/_create/api/upload/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ base64: input.base64 }),
        });
      } else if ("buffer" in input) {
        response = await fetch("/_create/api/upload/", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
          },
          body: input.buffer,
        });
      }

      if (!response || !response.ok) {
        if (response?.status === 413) {
          throw new Error("Upload failed: File too large.");
        }
        throw new Error("Upload failed");
      }

      const data: UploadResponse = await response.json();
      return { url: data.url, mimeType: data.mimeType || null };
    } catch (uploadError: unknown) {
      if (uploadError instanceof Error) {
        return { error: uploadError.message };
      }
      if (typeof uploadError === "string") {
        return { error: uploadError };
      }
      return { error: "Upload failed" };
    } finally {
      setLoading(false);
    }
  }, []);

  return [upload, { loading }];
}

export { useUpload };
export default useUpload;

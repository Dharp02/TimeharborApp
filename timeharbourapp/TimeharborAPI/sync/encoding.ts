/**
 * Base-64 encoding helpers for encrypted blob transport.
 *
 * CapacitorHttp serialises requests through the native bridge as JSON,
 * so binary payloads (ArrayBuffer / Uint8Array) must be base-64-encoded.
 * These helpers work identically on web and in WKWebView / Android WebView.
 */

/**
 * Encode an ArrayBuffer (or Uint8Array) to a base-64 string.
 */
export function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes =
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode a base-64 string back to a Uint8Array.
 */
export function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

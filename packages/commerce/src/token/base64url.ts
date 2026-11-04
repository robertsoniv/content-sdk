/**
 * Encodes a UTF-8 string as base64url (no padding). Works in browsers and Node.
 * @param {string} value string to encode
 * @returns {string} base64url-encoded value
 * @internal
 */
export function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes a base64url (or base64) string to UTF-8. Throws on invalid input.
 * @param {string} value base64url-encoded value
 * @returns {string} decoded string
 * @internal
 */
export function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

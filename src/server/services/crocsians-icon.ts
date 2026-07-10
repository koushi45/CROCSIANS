const MAX_ICON_BYTES = 1_000_000;

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function uint32le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function uint32be(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function webpDimensions(bytes: Uint8Array) {
  if (bytes.length < 20 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const chunk = ascii(bytes, offset, 4);
    const chunkSize = uint32le(bytes, offset + 4) >>> 0;
    const dataOffset = offset + 8;
    if (chunkSize > bytes.length - dataOffset) return null;
    if (chunk === "VP8X" && chunkSize >= 10) {
      return {
        width: 1 + bytes[dataOffset + 4] + (bytes[dataOffset + 5] << 8) + (bytes[dataOffset + 6] << 16),
        height: 1 + bytes[dataOffset + 7] + (bytes[dataOffset + 8] << 8) + (bytes[dataOffset + 9] << 16),
      };
    }
    if (chunk === "VP8 " && chunkSize >= 10) {
      return { width: (bytes[dataOffset + 6] | (bytes[dataOffset + 7] << 8)) & 0x3fff, height: (bytes[dataOffset + 8] | (bytes[dataOffset + 9] << 8)) & 0x3fff };
    }
    if (chunk === "VP8L" && chunkSize >= 5 && bytes[dataOffset] === 0x2f) {
      return {
        width: 1 + bytes[dataOffset + 1] + ((bytes[dataOffset + 2] & 0x3f) << 8),
        height: 1 + (bytes[dataOffset + 2] >> 6) + (bytes[dataOffset + 3] << 2) + ((bytes[dataOffset + 4] & 0x0f) << 10),
      };
    }
    offset = dataOffset + chunkSize + (chunkSize & 1);
  }
  return null;
}

function pngDimensions(bytes: Uint8Array) {
  if (bytes.length < 24 || ascii(bytes, 0, 8) !== "\x89PNG\r\n\x1a\n" || ascii(bytes, 12, 4) !== "IHDR") return null;
  return { width: uint32be(bytes, 16), height: uint32be(bytes, 20) };
}

export function inspectCharacterIcon(bytes: Uint8Array) {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ICON_BYTES) return null;
  const webp = webpDimensions(bytes);
  if (webp?.width === 256 && webp.height === 256) return { contentType: "image/webp" as const };
  const png = pngDimensions(bytes);
  if (png?.width === 256 && png.height === 256) return { contentType: "image/png" as const };
  return null;
}

export function validateCharacterIcon(bytes: Uint8Array) {
  return inspectCharacterIcon(bytes) !== null;
}

export function decodeCharacterIconDataUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^data:(image\/(?:webp|png));base64,([a-zA-Z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  const bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
  const metadata = inspectCharacterIcon(bytes);
  return metadata?.contentType === match[1] ? { bytes, contentType: metadata.contentType } : null;
}

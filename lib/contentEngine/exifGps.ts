// Reads GPS coordinates from a JPEG's EXIF block (GPS IFD tags 1–4).
//
// Location evidence for the Content Engine: the browser reads this from the
// ORIGINAL file before any resize (a canvas re-encode drops EXIF), and the
// finalize route reads it from the stored bytes when they were uploaded
// untouched. Coordinates are never published. Dependency-free so client code
// can import it; mirrors the structure of jpegOrientation.ts.

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
}

const GPS_IFD_POINTER = 0x8825;
const TYPE_ASCII = 2;
const TYPE_RATIONAL = 5;

/** Decimal GPS from a JPEG, or null when absent/unreadable. */
export function readJpegGps(bytes: Uint8Array): GpsCoordinates | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 4 || view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xda) return null; // start of scan: no metadata after this
    const length = view.getUint16(offset + 2);
    if (length < 2) return null;
    if (marker === 0xe1 && isExifHeader(bytes, offset + 4)) {
      return gpsFromTiff(view, offset + 10, Math.min(offset + 2 + length, view.byteLength));
    }
    offset += 2 + length;
  }
  return null;
}

function isExifHeader(bytes: Uint8Array, at: number): boolean {
  return bytes[at] === 0x45 && bytes[at + 1] === 0x78 && bytes[at + 2] === 0x69
    && bytes[at + 3] === 0x66 && bytes[at + 4] === 0 && bytes[at + 5] === 0;
}

interface Tiff { view: DataView; base: number; end: number; little: boolean }

function findEntry(t: Tiff, ifd: number, tag: number): number | null {
  if (ifd + 2 > t.end) return null;
  const count = t.view.getUint16(ifd, t.little);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > t.end) return null;
    if (t.view.getUint16(entry, t.little) === tag) return entry;
  }
  return null;
}

function asciiRef(t: Tiff, entry: number | null): string | null {
  if (entry === null || t.view.getUint16(entry + 2, t.little) !== TYPE_ASCII) return null;
  return String.fromCharCode(t.view.getUint8(entry + 8));
}

function degrees(t: Tiff, entry: number | null): number | null {
  if (entry === null || t.view.getUint16(entry + 2, t.little) !== TYPE_RATIONAL) return null;
  if (t.view.getUint32(entry + 4, t.little) < 3) return null;
  const at = t.base + t.view.getUint32(entry + 8, t.little);
  if (at + 24 > t.end) return null;
  const parts: number[] = [];
  for (let i = 0; i < 3; i++) {
    const num = t.view.getUint32(at + i * 8, t.little);
    const den = t.view.getUint32(at + i * 8 + 4, t.little);
    if (den === 0) return null;
    parts.push(num / den);
  }
  return parts[0] + parts[1] / 60 + parts[2] / 3600;
}

function gpsFromTiff(view: DataView, base: number, end: number): GpsCoordinates | null {
  if (base + 8 > end) return null;
  const order = view.getUint16(base);
  if (order !== 0x4949 && order !== 0x4d4d) return null;
  const t: Tiff = { view, base, end, little: order === 0x4949 };

  const pointer = findEntry(t, base + view.getUint32(base + 4, t.little), GPS_IFD_POINTER);
  if (pointer === null) return null;
  const gpsIfd = base + view.getUint32(pointer + 8, t.little);

  const latRef = asciiRef(t, findEntry(t, gpsIfd, 1));
  const lat = degrees(t, findEntry(t, gpsIfd, 2));
  const lonRef = asciiRef(t, findEntry(t, gpsIfd, 3));
  const lon = degrees(t, findEntry(t, gpsIfd, 4));
  if (lat === null || lon === null || !latRef || !lonRef) return null;

  return sanitizeGps({
    latitude: latRef === "S" ? -lat : lat,
    longitude: lonRef === "W" ? -lon : lon,
  });
}

/** Range-checks coordinates; (0,0) is the classic "no fix" placeholder. */
export function sanitizeGps(value: unknown): GpsCoordinates | null {
  if (!value || typeof value !== "object") return null;
  const { latitude, longitude } = value as Record<string, unknown>;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude: Math.round(latitude * 1e6) / 1e6, longitude: Math.round(longitude * 1e6) / 1e6 };
}

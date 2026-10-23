// Reads the EXIF orientation tag (0x0112) from the start of a JPEG.
//
// The upload path re-encodes large JPEGs in the browser, and a canvas
// re-encode drops EXIF. A file whose orientation is anything but "normal"
// would then rely on the browser having applied the rotation while decoding —
// which is not guaranteed everywhere — so those files are uploaded untouched
// and the server rotates them as before. Dependency-free: client code imports it.

/** EXIF orientation 1–8, or 1 when the file has no orientation tag. Null when it isn't a JPEG we can read. */
export function readJpegOrientation(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 4 || view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    // Start of scan: image data follows and no further metadata can appear.
    if (marker === 0xda) return 1;
    const length = view.getUint16(offset + 2);
    if (length < 2) return null;
    if (marker === 0xe1 && isExifHeader(bytes, offset + 4)) {
      return orientationFromTiff(view, offset + 10, offset + 2 + length);
    }
    offset += 2 + length;
  }
  return 1;
}

function isExifHeader(bytes: Uint8Array, at: number): boolean {
  // "Exif\0\0"
  return bytes[at] === 0x45 && bytes[at + 1] === 0x78 && bytes[at + 2] === 0x69
    && bytes[at + 3] === 0x66 && bytes[at + 4] === 0 && bytes[at + 5] === 0;
}

function orientationFromTiff(view: DataView, tiff: number, end: number): number | null {
  if (tiff + 8 > end || end > view.byteLength) return null;
  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return null;
  const little = order === 0x4949;
  const ifd = tiff + view.getUint32(tiff + 4, little);
  if (ifd + 2 > end) return null;
  const entries = view.getUint16(ifd, little);
  for (let i = 0; i < entries; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > end) return null;
    if (view.getUint16(entry, little) === 0x0112) {
      const value = view.getUint16(entry + 8, little);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return 1;
}

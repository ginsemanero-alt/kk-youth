/**
 * Shrinks a photo in the browser before upload: longest side at most `max` pixels, saved as JPEG.
 * Keeps phone photos (often 4-10 MB) well under the 5 MB bucket limit and fast to load.
 * Also drops the EXIF data (including GPS location) because only the pixels are redrawn.
 */
export async function resizeImage(file: File, max = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot prepare the photo.')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not prepare the photo.'))), 'image/jpeg', quality),
  )
}

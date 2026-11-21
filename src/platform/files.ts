import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

const native = () => Capacitor.isNativePlatform()

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Share a file through the Android share sheet, or download it in a browser. */
export async function shareFile(
  name: string,
  data: Uint8Array | string,
  mime: string,
  title?: string,
): Promise<void> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  if (native()) {
    const written = await Filesystem.writeFile({
      path: name,
      data: toBase64(bytes),
      directory: Directory.Cache,
    })
    await Share.share({ title: title ?? name, url: written.uri })
    return
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Open a file picker and read the chosen files. */
export function pickFiles(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.onchange = () => resolve(Array.from(input.files ?? []))
    input.click()
  })
}

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

export const safeFileName = (s: string) =>
  s
    .replace(/[^\p{L}\p{N} _-]+/gu, '')
    .trim()
    .slice(0, 60) || 'song'

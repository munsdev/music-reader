import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'
import { pickFiles, readAsDataUrl } from './files'

/** Take one photo with the camera. Returns a data URL, or null if cancelled. */
export async function takePhoto(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) {
    const [file] = await pickFiles('image/*')
    return file ? readAsDataUrl(file) : null
  }
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      resultType: CameraResultType.DataUrl,
      quality: 90,
      width: 2400,
      correctOrientation: true,
    })
    return photo.dataUrl ?? null
  } catch {
    return null
  }
}

/** Pick one or more images from the gallery. */
export async function pickImages(): Promise<string[]> {
  if (!Capacitor.isNativePlatform()) {
    const files = await pickFiles('image/*', true)
    return Promise.all(files.map(readAsDataUrl))
  }
  try {
    const { photos } = await Camera.pickImages({ quality: 90, width: 2400 })
    return Promise.all(
      photos.map(async (p) => readAsDataUrl(await (await fetch(p.webPath)).blob())),
    )
  } catch {
    return []
  }
}

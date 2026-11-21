import { isFullQuad, mapPoint, outputSize, squareToQuad, type Quad } from '../core/crop'

/**
 * Turns a page photo plus its crop corners and rotation into the flattened image that the
 * app shows everywhere (thumbnails, note entry, Review) and hands to recognition.
 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the photo.'))
    img.src = src
  })
}

export async function renderPage(
  photo: string,
  corners: Quad | undefined,
  rotation: number,
  maxSide = 1800,
): Promise<string> {
  const img = await loadImage(photo)
  const W = img.naturalWidth
  const H = img.naturalHeight
  let canvas = document.createElement('canvas')

  if (isFullQuad(corners)) {
    const scale = Math.min(1, maxSide / Math.max(W, H))
    canvas.width = Math.round(W * scale)
    canvas.height = Math.round(H * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  } else {
    const q = corners!
    const out = outputSize(q, W, H, maxSide)
    // Read the source pixels once at a resolution close to the output.
    const srcScale = Math.min(1, (maxSide * 1.25) / Math.max(W, H))
    const sw = Math.round(W * srcScale)
    const sh = Math.round(H * srcScale)
    const src = document.createElement('canvas')
    src.width = sw
    src.height = sh
    const sctx = src.getContext('2d')!
    sctx.drawImage(img, 0, 0, sw, sh)
    const sdata = sctx.getImageData(0, 0, sw, sh).data
    canvas.width = out.width
    canvas.height = out.height
    const ctx = canvas.getContext('2d')!
    const dst = ctx.createImageData(out.width, out.height)
    const m = squareToQuad(q)
    for (let y = 0; y < out.height; y++) {
      const v = (y + 0.5) / out.height
      for (let x = 0; x < out.width; x++) {
        const [fx, fy] = mapPoint(m, (x + 0.5) / out.width, v)
        // Bilinear sample.
        const sx = Math.min(sw - 1.001, Math.max(0, fx * sw - 0.5))
        const sy = Math.min(sh - 1.001, Math.max(0, fy * sh - 0.5))
        const x0 = Math.floor(sx)
        const y0 = Math.floor(sy)
        const ax = sx - x0
        const ay = sy - y0
        const i00 = (y0 * sw + x0) * 4
        const i10 = i00 + 4
        const i01 = i00 + sw * 4
        const i11 = i01 + 4
        const o = (y * out.width + x) * 4
        for (let c = 0; c < 3; c++) {
          const top = sdata[i00 + c]! * (1 - ax) + sdata[i10 + c]! * ax
          const bottom = sdata[i01 + c]! * (1 - ax) + sdata[i11 + c]! * ax
          dst.data[o + c] = top * (1 - ay) + bottom * ay
        }
        dst.data[o + 3] = 255
      }
    }
    ctx.putImageData(dst, 0, 0)
  }

  const turns = (((rotation % 360) + 360) % 360) / 90
  if (turns) {
    const r = document.createElement('canvas')
    const swap = turns % 2 === 1
    r.width = swap ? canvas.height : canvas.width
    r.height = swap ? canvas.width : canvas.height
    const rctx = r.getContext('2d')!
    rctx.translate(r.width / 2, r.height / 2)
    rctx.rotate((turns * Math.PI) / 2)
    rctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
    canvas = r
  }
  return canvas.toDataURL('image/jpeg', 0.88)
}

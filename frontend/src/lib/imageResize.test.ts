import { describe, it, expect } from 'vitest'
import { downscaleImage } from './imageResize'

/**
 * jsdom has no canvas or createImageBitmap, so these cover the "can't resize,
 * return the original" paths that the upload flow relies on: the field must
 * never lose the user's file just because the browser couldn't shrink it.
 */
describe('downscaleImage', () => {
  it('returns GIFs untouched so animation survives', async () => {
    const gif = new File([new Uint8Array([0x47, 0x49, 0x46])], 'loop.gif', { type: 'image/gif' })
    expect(await downscaleImage(gif)).toBe(gif)
  })

  it('returns non-image files untouched', async () => {
    const txt = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    expect(await downscaleImage(txt)).toBe(txt)
  })

  it('falls back to the original when the environment cannot decode the image', async () => {
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' })
    // jsdom's Image never fires load or error, so this exercises the decode timeout.
    expect(await downscaleImage(jpeg, { decodeTimeoutMs: 50 })).toBe(jpeg)
  })
})

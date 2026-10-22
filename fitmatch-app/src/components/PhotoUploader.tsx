'use client'

import { useRef, useState } from 'react'
import { ImagePlus, LoaderCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export interface UploadedPhoto {
  path: string // storage path: <userId>/<uuid>.<ext>
  previewUrl: string // local object URL, only for this session
}

const MAX_PHOTOS = 6
const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const SLOT_HINTS = ['Main photo', 'Training shot', 'Full body', 'With friends', 'Hobby', 'Anything']

/**
 * Six photo slots. Files upload straight to the private `photos` bucket
 * (storage RLS only allows writes into the user's own folder); the parent
 * form gets the storage paths and saves them with the profile.
 */
export function PhotoUploader({
  userId,
  photos,
  onChange,
  error,
}: {
  userId: string
  photos: UploadedPhoto[]
  onChange: (photos: UploadedPhoto[]) => void
  error?: string
}) {
  const supabase = useRef(createClient()).current
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [uploadError, setUploadError] = useState<string>()

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setUploadError(undefined)

    const room = MAX_PHOTOS - photos.length
    const picked = Array.from(files).slice(0, room)
    const invalid = picked.find((f) => !ACCEPTED.includes(f.type) || f.size > MAX_BYTES)
    if (invalid) {
      setUploadError('Use JPG, PNG or WebP images under 5 MB.')
      return
    }

    setUploading(picked.length)
    const results = await Promise.all(
      picked.map(async (file) => {
        const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
        const path = `${userId}/${crypto.randomUUID()}.${ext}`
        const { error } = await supabase.storage.from('photos').upload(path, file, {
          contentType: file.type,
          cacheControl: '3600',
        })
        return error ? null : { path, previewUrl: URL.createObjectURL(file) }
      }),
    )
    setUploading(0)

    const ok = results.filter((r): r is UploadedPhoto => r !== null)
    if (ok.length < picked.length) setUploadError('Some photos failed to upload. Try again.')
    onChange([...photos, ...ok])
    if (inputRef.current) inputRef.current.value = ''
  }

  async function remove(photo: UploadedPhoto) {
    onChange(photos.filter((p) => p.path !== photo.path))
    URL.revokeObjectURL(photo.previewUrl)
    await supabase.storage.from('photos').remove([photo.path])
  }

  function makeMain(index: number) {
    const next = [...photos]
    const [moved] = next.splice(index, 1)
    onChange([moved, ...next])
  }

  const message = uploadError ?? error

  return (
    <div>
      <ul className="grid grid-cols-3 gap-3">
        {Array.from({ length: MAX_PHOTOS }, (_, i) => {
          const photo = photos[i]
          const isLoadingSlot = !photo && i < photos.length + uploading

          if (photo) {
            return (
              <li key={photo.path} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.previewUrl} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                {i === 0 ? (
                  <span className="absolute bottom-2 left-2 rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">
                    Main
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makeMain(i)}
                    className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white hover:bg-black/80"
                  >
                    Make main
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(photo)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            )
          }

          return (
            <li key={`empty-${i}`}>
              <button
                type="button"
                disabled={isLoadingSlot || uploading > 0}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'flex aspect-[3/4] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed',
                  'bg-surface text-muted-fg transition-colors hover:border-primary hover:text-primary',
                  message && photos.length === 0 && 'border-danger',
                )}
                aria-label={`Add photo: ${SLOT_HINTS[i]}`}
              >
                {isLoadingSlot ? (
                  <LoaderCircle className="size-6 animate-spin" aria-hidden />
                ) : (
                  <>
                    <ImagePlus className="size-6" aria-hidden />
                    <span className="px-1 text-center text-xs">{SLOT_HINTS[i]}</span>
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      <p className="mt-3 text-sm text-muted-fg">
        {photos.length}/{MAX_PHOTOS} added. Photos are reviewed before other members can see them.
      </p>
      {message && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {message}
        </p>
      )}
    </div>
  )
}

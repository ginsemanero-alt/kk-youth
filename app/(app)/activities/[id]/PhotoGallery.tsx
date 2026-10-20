'use client'
import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Loader2, Pencil, ShieldCheck, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { resizeImage } from '@/lib/image'
import { formatDateTime } from '@/lib/format'
import { useToast } from '@/components/Toast'
import type { ActivityPhoto } from '@/lib/types'
import { Alert, Card, SectionTitle, btnPrimary, inputCls } from '@/components/ui'

export interface GalleryPhoto extends ActivityPhoto { url: string | null }

const BUCKET = 'activity-photos'
const MAX_PHOTOS = 40
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Activity photos (private bucket, Admin and Encoder only). Links to the files are signed and expire
 * after an hour. An Encoder can remove their own photos; an Admin can remove any (the database enforces it).
 */
export default function PhotoGallery({ activityId, initial, meId, isAdmin }: { activityId: string; initial: GalleryPhoto[]; meId: string; isAdmin: boolean }) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const fail = (m: string) => { setError(m); toast.error(m) }
  const canDelete = (p: GalleryPhoto) => isAdmin || p.uploaded_by === meId

  // Keyboard navigation in the viewer.
  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      if (e.key === 'ArrowRight') setOpen((i) => (i === null ? i : (i + 1) % photos.length))
      if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? i : (i - 1 + photos.length) % photos.length))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, photos.length])

  const upload = async (files: FileList) => {
    setError(null)
    const list = [...files].filter((f) => ACCEPT.includes(f.type))
    if (list.length < files.length) toast.error('Only JPG, PNG or WebP photos can be added.')
    if (!list.length) return
    if (photos.length + list.length > MAX_PHOTOS) return fail(`An activity can have at most ${MAX_PHOTOS} photos (${MAX_PHOTOS - photos.length} left).`)
    const supabase = createClient()
    setBusy('upload'); setProgress({ done: 0, total: list.length })
    const added: GalleryPhoto[] = []
    for (const file of list) {
      try {
        const blob = await resizeImage(file)
        if (blob.size > 5 * 1024 * 1024) throw new Error(`${file.name} is still larger than 5 MB.`)
        const path = `${activityId}/${crypto.randomUUID()}.jpg`
        const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
        if (up.error) throw up.error
        const { data, error: err } = await supabase.from('activity_photos').insert({ activity_id: activityId, path }).select('*').single()
        if (err) { await supabase.storage.from(BUCKET).remove([path]); throw err }
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
        added.push({ ...(data as ActivityPhoto), url: signed?.signedUrl ?? null })
      } catch (e) {
        fail(`${file.name}: ${friendlyError(e as { message?: string })}`)
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p))
    }
    setPhotos((ps) => [...ps, ...added])
    setBusy(null); setProgress(null)
    if (added.length) toast.success(`${added.length} photo${added.length === 1 ? '' : 's'} added.`)
  }

  const remove = async (p: GalleryPhoto) => {
    if (!window.confirm('Delete this photo? This cannot be undone.')) return
    setError(null); setBusy(p.id)
    const supabase = createClient()
    // File first: the storage rule checks the photo row to see who uploaded it.
    const rm = await supabase.storage.from(BUCKET).remove([p.path])
    const del = rm.error ? null : await supabase.from('activity_photos').delete().eq('id', p.id).select('id')
    setBusy(null)
    if (rm.error || del?.error) return fail(friendlyError(rm.error ?? del?.error))
    if (!del?.data?.length) return fail('You can only delete photos you uploaded.')
    setPhotos((ps) => ps.filter((x) => x.id !== p.id))
    setOpen(null)
    toast.success('Photo deleted.')
  }

  const saveCaption = async (p: GalleryPhoto) => {
    setBusy(p.id)
    const { data, error: err } = await createClient().from('activity_photos').update({ caption: caption.trim() || null }).eq('id', p.id).select('caption')
    setBusy(null)
    if (err || !data?.length) return fail(err ? friendlyError(err) : 'Could not save the caption.')
    setPhotos((ps) => ps.map((x) => (x.id === p.id ? { ...x, caption: data[0].caption as string | null } : x)))
    setEditing(null)
  }

  const current = open === null ? null : photos[open]

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle sub={`${photos.length} of ${MAX_PHOTOS} photos`}>
          <span className="inline-flex items-center gap-2"><Camera className="h-6 w-6 text-brand" aria-hidden /> Photos</span>
        </SectionTitle>
        <div>
          <input ref={input} type="file" accept={ACCEPT.join(',')} multiple className="sr-only" aria-label="Add photos"
            onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = '' }} />
          <button onClick={() => input.current?.click()} disabled={busy !== null || photos.length >= MAX_PHOTOS} className={btnPrimary}>
            {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {progress ? `Uploading ${progress.done} of ${progress.total}` : 'Add photos'}
          </button>
        </div>
      </div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {photos.length === 0 ? (
        <button onClick={() => input.current?.click()} disabled={busy !== null}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-[2.5rem] border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition hover:border-brand hover:bg-brand-soft/40">
          <ImagePlus className="h-10 w-10 text-brand" aria-hidden />
          <span className="font-black">Add photos of this activity</span>
          <span className="text-sm font-semibold text-slate-500">JPG, PNG or WebP. Photos are resized before upload.</span>
        </button>
      ) : (
        <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p.id} className="group relative overflow-hidden rounded-[1.75rem] bg-slate-100 ring-1 ring-black/5">
              <button onClick={() => setOpen(i)} className="block aspect-square w-full" aria-label={`Open photo ${i + 1}${p.caption ? `: ${p.caption}` : ''}`}>
                {p.url
                  ? <img src={p.url} alt={p.caption ?? `Activity photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  : <span className="flex h-full items-center justify-center text-xs font-bold text-slate-400">Unavailable</span>}
              </button>
              {p.caption && <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-ink/80 to-transparent px-3 pb-2 pt-6 text-xs font-bold text-white">{p.caption}</span>}
              {busy === p.id && <span className="absolute inset-0 flex items-center justify-center bg-white/60"><Loader2 className="h-6 w-6 animate-spin" /></span>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-400">
        <ShieldCheck className="h-4 w-4" aria-hidden /> Private: only the Admin and encoders can see these photos. Location data is removed on upload.
      </p>

      {current && open !== null && (
        <div className="fixed inset-0 z-50 flex animate-fade flex-col bg-ink/95 p-3 backdrop-blur sm:p-6" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between gap-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm font-black">{open + 1} / {photos.length}</span>
            <button onClick={() => setOpen(null)} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"><X className="h-5 w-5" /></button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center py-3">
            {photos.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + photos.length) % photos.length) }} aria-label="Previous photo"
                className="absolute left-0 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft className="h-6 w-6" /></button>
            )}
            {current.url && <img src={current.url} alt={current.caption ?? ''} className="max-h-full max-w-full animate-pop rounded-[1.5rem] object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />}
            {photos.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % photos.length) }} aria-label="Next photo"
                className="absolute right-0 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight className="h-6 w-6" /></button>
            )}
          </div>
          <div className="mx-auto w-full max-w-2xl rounded-[2rem] bg-white/10 p-4 text-white" onClick={(e) => e.stopPropagation()}>
            {editing === current.id ? (
              <div className="flex gap-2">
                <input className={`${inputCls} !text-ink`} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder="Caption" autoFocus />
                <button onClick={() => saveCaption(current)} disabled={busy !== null} className={btnPrimary}>Save</button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black">{current.caption || <span className="text-white/50">No caption</span>}</p>
                  <p className="text-xs font-semibold text-white/50">Added {formatDateTime(current.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(current.id); setCaption(current.caption ?? '') }} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-black hover:bg-white/20"><Pencil className="h-4 w-4" /> Caption</button>
                  {canDelete(current) && (
                    <button onClick={() => remove(current)} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-full bg-flag px-4 py-2 text-sm font-black hover:brightness-110"><Trash2 className="h-4 w-4" /> Delete</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

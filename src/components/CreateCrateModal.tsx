import { useState, type ChangeEvent, type FormEvent } from 'react';
import { FolderPlus, ImagePlus, Trash2, X } from 'lucide-react';
import type { HubCrate } from '../types/hub';

interface CreateCrateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (crate: HubCrate) => void;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function CreateCrateModal({
  isOpen,
  onClose,
  onCreated,
}: CreateCrateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverPreviewError, setCoverPreviewError] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please select a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('Crate cover image must be 5MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setUploadingCover(true);
      try {
        const res = await fetch('/api/media/upload', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl, folder: 'crate-covers' }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(payload?.error || 'Unable to upload crate cover image.');
          return;
        }
        if (payload?.url) {
          setCoverUrl(payload.url);
          setCoverPreviewError(false);
        }
      } catch {
        setError('Network error uploading crate cover image.');
      } finally {
        setUploadingCover(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/crates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          coverUrl: coverUrl.trim() || undefined,
          isPublic,
        }),
      });

      const raw = await res.text();
      let data: { error?: string; crate?: HubCrate } = {};
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = {};
        }
      }

      if (!res.ok) {
        setError(data?.error || `Failed to create crate (HTTP ${res.status}).`);
        return;
      }

      if (data?.crate) {
        onCreated(data.crate);
        setTitle('');
        setDescription('');
        setCoverUrl('');
        setCoverPreviewError(false);
        setIsPublic(true);
        onClose();
      }
    } catch {
      setError('Network error while creating crate.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1B18]/45 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-crate-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 border-b border-[#DDD5C7] pb-4">
          <div>
            <p className="text-xs font-medium text-[#B84A2E]">Curation Board</p>
            <h2
              id="create-crate-title"
              className="mt-1 font-display text-2xl font-semibold text-[#1F1B18]"
            >
              New Listening Crate
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#1F1B18]">Crate Title</span>
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Midnight Pressing"
              className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-sm text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#1F1B18]">
              Description (optional)
            </span>
            <textarea
              rows={3}
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Warm late-night downtempo, tape loops, and B-sides."
              className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-sm text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#1F1B18]">
                Cover Image (optional, max 5MB)
              </span>
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B84A2E] hover:text-[#9E3D24] cursor-pointer">
                <ImagePlus className="w-3.5 h-3.5" />
                <span>{uploadingCover ? 'Uploading...' : 'Upload file'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploadingCover}
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={coverUrl}
                onChange={(e) => {
                  setCoverUrl(e.target.value);
                  setCoverPreviewError(false);
                }}
                placeholder="https://... or upload JPEG/PNG/WebP"
                className="flex-1 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-xs text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
              />
              {coverUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setCoverUrl('');
                    setCoverPreviewError(false);
                  }}
                  aria-label="Clear cover image"
                  className="p-2 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-[#5C534A] hover:text-[#B84A2E] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {coverUrl.startsWith('https://') && (
              <div className="h-24 w-24 overflow-hidden rounded-lg border border-[#DDD5C7] bg-[#EFE9DE] flex items-center justify-center">
                {!coverPreviewError ? (
                  <img
                    src={coverUrl}
                    alt="Crate cover preview"
                    referrerPolicy="no-referrer"
                    onError={() => setCoverPreviewError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[11px] text-[#5C534A] px-2 text-center">
                    Preview unavailable
                  </span>
                )}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2.5 text-xs text-[#1F1B18] cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="accent-[#B84A2E]"
            />
            <span>Public collaborative crate (community members can add tracks)</span>
          </label>

          {error && (
            <p className="rounded-md border border-[#B84A2E]/30 bg-[#B84A2E]/10 px-3 py-2 text-xs text-[#9E3D24]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-[#DDD5C7] text-xs font-medium text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingCover}
              className="inline-flex items-center gap-2 rounded-md bg-[#B84A2E] px-4 py-2 text-xs font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{submitting ? 'Creating...' : 'Create Crate'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { Link2, X } from 'lucide-react';
import type { FeedPost, HubCrate } from '../types/hub';

interface ShareTrackModalProps {
  isOpen: boolean;
  crates: HubCrate[];
  onClose: () => void;
  onCreated: (post: FeedPost) => void;
}

export function ShareTrackModal({
  isOpen,
  crates,
  onClose,
  onCreated,
}: ShareTrackModalProps) {
  const [mediaUrl, setMediaUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [selectedCrateId, setSelectedCrateId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaUrl: mediaUrl.trim(),
          tags: parsedTags,
          crateId: selectedCrateId || undefined,
        }),
      });

      const raw = await res.text();
      let data: { error?: string; post?: FeedPost } = {};
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = {};
        }
      }

      if (!res.ok) {
        setError(data?.error || `Failed to share track (HTTP ${res.status}).`);
        return;
      }

      if (data?.post) {
        onCreated(data.post);
        setMediaUrl('');
        setTagsInput('');
        setSelectedCrateId('');
        onClose();
      }
    } catch {
      setError('Network error while contacting post creation endpoint.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1B18]/45 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-track-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-[#DDD5C7] pb-4">
          <div>
            <p className="text-xs font-medium text-[#B84A2E]">Discovery Submission</p>
            <h2
              id="share-track-title"
              className="mt-1 font-display text-2xl font-semibold text-[#1F1B18]"
            >
              Share a Track
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
            <span className="text-xs font-medium text-[#1F1B18]">
              SoundCloud or YouTube URL
            </span>
            <input
              type="url"
              required
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://soundcloud.com/artist/track or https://www.youtube.com/watch?v=..."
              className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-sm text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
            />
            <span className="block text-[11px] text-[#5C534A]">
              Title, artist, and cover artwork are fetched directly from the provider oEmbed API.
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#1F1B18]">
              Fandom &amp; Genre Tags (comma-separated)
            </span>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="shoegaze, tape-loop, analog"
              className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-sm text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
            />
          </label>

          {crates.length > 0 && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#1F1B18]">
                Add to Crate (optional)
              </span>
              <select
                value={selectedCrateId}
                onChange={(e) => setSelectedCrateId(e.target.value)}
                className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-sm text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
              >
                <option value="">None</option>
                {crates.map((crate) => (
                  <option key={crate.id} value={crate.id}>
                    {crate.title}
                  </option>
                ))}
              </select>
            </label>
          )}

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
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-[#B84A2E] px-4 py-2 text-xs font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>{submitting ? 'Fetching Metadata...' : 'Publish to Feed'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

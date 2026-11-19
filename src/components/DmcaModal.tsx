import { useState, type FormEvent } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import type { FeedPost } from '../types/hub';
import type { SessionUser } from './AuthGateModal';

interface DmcaModalProps {
  post: FeedPost | null;
  sessionUser: SessionUser | null;
  onClose: () => void;
  onReported: (postId: string) => void;
}

export function DmcaModal({
  post,
  sessionUser,
  onClose,
  onReported,
}: DmcaModalProps) {
  const [claimantName, setClaimantName] = useState(
    sessionUser?.verifiedArtistName || sessionUser?.username || '',
  );
  const [reporterEmail, setReporterEmail] = useState(sessionUser?.email || '');
  const [rightsUrl, setRightsUrl] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!post) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/dmca/report', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          claimantName,
          reporterEmail,
          rightsUrl: rightsUrl.trim() || undefined,
          reason,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Unable to submit DMCA notice.');
        return;
      }
      onReported(post.id);
      onClose();
    } catch {
      setError('Network error submitting DMCA notice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1F1B18]/50 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dmca-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#DDD5C7] pb-4">
          <div>
            <p className="text-xs font-medium text-[#B84A2E]">
              Rights &amp; Takedown Workflow
            </p>
            <h2
              id="dmca-modal-title"
              className="mt-1 font-display text-2xl font-semibold text-[#1F1B18]"
            >
              Submit DMCA Notice
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close DMCA modal"
            className="p-1.5 text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3.5 py-2.5 text-xs text-[#5C534A]">
            Reporting track:{' '}
            <span className="font-semibold text-[#1F1B18]">{post.title}</span> by{' '}
            {post.artistName}. Filing a notice hides the post pending admin review and triggers Resend email alerts.
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#1F1B18]">
              Claimant / Rights Holder Name
            </span>
            <input
              type="text"
              required
              value={claimantName}
              onChange={(e) => setClaimantName(e.target.value)}
              placeholder="Label or Artist Legal Name"
              className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-sm text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#1F1B18]">
              Contact Email (for Resend resolution notice)
            </span>
            <input
              type="email"
              required
              value={reporterEmail}
              onChange={(e) => setReporterEmail(e.target.value)}
              placeholder="rights@label.com"
              className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-sm text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#1F1B18]">
              Official Master / Proof URL (optional)
            </span>
            <input
              type="url"
              value={rightsUrl}
              onChange={(e) => setRightsUrl(e.target.value)}
              placeholder="https://official-release.example.com"
              className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-sm text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#1F1B18]">
              Description of Copyright Claim
            </span>
            <textarea
              rows={3}
              required
              minLength={10}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the copyrighted work and why this share violates rights..."
              className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-sm text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
            />
          </label>

          {error && (
            <p className="rounded-md border border-[#B84A2E]/30 bg-[#B84A2E]/10 px-3 py-2 text-xs text-[#9E3D24]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#B84A2E] text-xs font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] disabled:opacity-60 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting...' : 'Submit DMCA Notice'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

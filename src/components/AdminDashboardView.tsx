import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  BadgeCheck,
  Check,
  Copy,
  Eye,
  Mail,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type { AdminOverviewResponse } from '../types/hub';
import type { SessionUser } from './AuthGateModal';
import { VerifiedBadge } from './VerifiedBadge';

type AdminTab = 'moderation' | 'dmca' | 'verifications' | 'members';

interface AdminDashboardViewProps {
  sessionUser: SessionUser;
  onFeedChanged: () => void;
}

export function AdminDashboardView({
  sessionUser,
  onFeedChanged,
}: AdminDashboardViewProps) {
  const [tab, setTab] = useState<AdminTab>('moderation');
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Invite creation state
  const [customInviteCode, setCustomInviteCode] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Resend manual alert state
  const [alertRecipient, setAlertRecipient] = useState(sessionUser.email || '');
  const [alertSubject, setAlertSubject] = useState('SONA Moderation & Resend Workflow Check');
  const [alertBody, setAlertBody] = useState(
    'This is an operational alert dispatched from the SONA v1.1 Admin Dashboard.',
  );
  const [sendingAlert, setSendingAlert] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/overview', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Unable to load Admin Dashboard.');
        return;
      }
      setOverview(data as AdminOverviewResponse);
    } catch {
      setError('Network error loading Admin Dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleRestorePost = async (postId: string) => {
    setNotice(null);
    const res = await fetch(`/api/admin/posts/${encodeURIComponent(postId)}/visibility`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHidden: false }),
    });
    if (res.ok) {
      setNotice('Post restored to the public Discovery Feed.');
      await loadOverview();
      onFeedChanged();
    }
  };

  const handleDeletePost = async (postId: string) => {
    setNotice(null);
    const res = await fetch(`/api/posts/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      setNotice('Flagged post permanently deleted.');
      await loadOverview();
      onFeedChanged();
    }
  };

  const handleResolveDmca = async (
    reportId: string,
    status: 'takedown_applied' | 'dismissed',
    restorePost = false,
  ) => {
    setNotice(null);
    const res = await fetch(`/api/admin/dmca/${encodeURIComponent(reportId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, restorePost }),
    });
    if (res.ok) {
      setNotice(
        status === 'takedown_applied'
          ? 'DMCA takedown upheld and Resend resolution notice dispatched.'
          : 'DMCA notice dismissed and resolution alerts dispatched.',
      );
      await loadOverview();
      onFeedChanged();
    }
  };

  const handleReviewVerification = async (
    requestId: string,
    status: 'approved' | 'rejected',
  ) => {
    setNotice(null);
    const res = await fetch(`/api/admin/verifications/${encodeURIComponent(requestId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setNotice(
        status === 'approved'
          ? 'Verified Artist badge granted and confirmation email dispatched.'
          : 'Verification request marked rejected.',
      );
      await loadOverview();
      onFeedChanged();
    }
  };

  const handleToggleVerifiedUser = async (
    userId: string,
    nextVerified: boolean,
    username: string,
  ) => {
    setNotice(null);
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/verified`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isVerifiedArtist: nextVerified,
        verifiedArtistName: nextVerified ? username : null,
      }),
    });
    if (res.ok) {
      setNotice(
        nextVerified
          ? `Granted Verified Artist badge to @${username}.`
          : `Removed Verified Artist badge from @${username}.`,
      );
      await loadOverview();
      onFeedChanged();
    }
  };

  const handleToggleRole = async (
    userId: string,
    nextRole: 'user' | 'admin',
    username: string,
  ) => {
    setNotice(null);
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: nextRole }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || 'Unable to update member role.');
      return;
    }
    setNotice(`Updated @${username} role to ${nextRole}.`);
    await loadOverview();
  };

  const handleCreateInvite = async (e: FormEvent) => {
    e.preventDefault();
    setCreatingInvite(true);
    setNotice(null);
    try {
      const res = await fetch('/api/auth/invite/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: customInviteCode.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Unable to generate invite code.');
        return;
      }
      setCustomInviteCode('');
      setNotice(`Invite code ${data.invite.code} created.`);
      await loadOverview();
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyInvite = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSendAlert = async (e: FormEvent) => {
    e.preventDefault();
    setSendingAlert(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/alerts/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: alertRecipient,
          subject: alertSubject,
          text: alertBody,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Resend alert dispatch failed.');
      } else {
        setNotice(
          data.deliveryStatus === 'sent'
            ? `Email dispatched via Resend (${data.providerMessageId || 'OK'}).`
            : 'RESEND_API_KEY is not configured yet — alert recorded in email_alerts log.',
        );
      }
      await loadOverview();
    } finally {
      setSendingAlert(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[#DDD5C7] pb-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#1F1B18]">
            Admin Console
          </h2>
          <p className="text-xs text-[#5C534A]">
            Flagged post moderation, Verified Artist claims, DMCA takedowns, and Resend email workflows.
          </p>
        </div>
        <button
          type="button"
          onClick={loadOverview}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#DDD5C7] bg-[#FCF9F4] text-xs font-medium text-[#1F1B18] hover:border-[#B84A2E] cursor-pointer whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {notice && (
        <p className="rounded-md border border-[#DDD5C7] bg-[#FCF9F4] px-4 py-2.5 text-xs text-[#1F1B18]">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-[#B84A2E]/30 bg-[#B84A2E]/10 px-4 py-2.5 text-xs text-[#9E3D24]">
          {error}
        </p>
      )}

      {loading && !overview ? (
        <div className="space-y-3">
          <div className="h-20 rounded-lg bg-[#EFE9DE] animate-pulse" />
          <div className="h-48 rounded-lg bg-[#EFE9DE] animate-pulse" />
        </div>
      ) : overview ? (
        <>
          {/* Summary Stats Strip (Single-level flat container with hairline dividers) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-[#DDD5C7] rounded-xl border border-[#DDD5C7] bg-[#FCF9F4]">
            <div className="p-4">
              <p className="text-[11px] text-[#5C534A]">Members</p>
              <p className="mt-1 font-mono-tabular text-xl font-semibold text-[#1F1B18]">
                {overview.stats.usersCount}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[11px] text-[#5C534A]">Verified Artists</p>
              <p className="mt-1 font-mono-tabular text-xl font-semibold text-[#B84A2E]">
                {overview.stats.verifiedArtistsCount}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[11px] text-[#5C534A]">Total Tracks</p>
              <p className="mt-1 font-mono-tabular text-xl font-semibold text-[#1F1B18]">
                {overview.stats.postsCount}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[11px] text-[#5C534A]">Hidden / Flagged</p>
              <p className="mt-1 font-mono-tabular text-xl font-semibold text-[#9E3D24]">
                {overview.stats.flaggedPostsCount}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[11px] text-[#5C534A]">Open DMCA</p>
              <p className="mt-1 font-mono-tabular text-xl font-semibold text-[#9E3D24]">
                {overview.stats.openDmcaCount}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[11px] text-[#5C534A]">Artist Claims</p>
              <p className="mt-1 font-mono-tabular text-xl font-semibold text-[#9A6721]">
                {overview.stats.pendingVerificationsCount}
              </p>
            </div>
          </div>

          {/* Segmented Section Tabs */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#DDD5C7] bg-[#EFE9DE] p-1">
            {(
              [
                {
                  id: 'moderation',
                  label: `Moderation (${overview.flaggedPosts.length})`,
                },
                {
                  id: 'dmca',
                  label: `DMCA & Resend (${overview.dmcaReports.length})`,
                },
                {
                  id: 'verifications',
                  label: `Artist Claims (${overview.verificationRequests.length})`,
                },
                {
                  id: 'members',
                  label: `Invites & Members (${overview.members.length})`,
                },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tab === item.id
                    ? 'bg-[#FCF9F4] text-[#1F1B18] shadow-xs'
                    : 'text-[#5C534A] hover:text-[#1F1B18]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Moderation Queue */}
          {tab === 'moderation' && (
            <div className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] overflow-hidden">
              <div className="border-b border-[#DDD5C7] px-5 py-3.5 flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-[#1F1B18]">
                  Flagged &amp; Hidden Posts
                </h3>
                <span className="font-mono-tabular text-xs text-[#5C534A]">
                  {overview.flaggedPosts.length} queued
                </span>
              </div>

              {overview.flaggedPosts.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#5C534A]">
                  No flagged or hidden tracks awaiting moderation.
                </div>
              ) : (
                <ul className="divide-y divide-[#DDD5C7]">
                  {overview.flaggedPosts.map((post) => (
                    <li
                      key={post.id}
                      className="px-5 py-4 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-[#1F1B18] truncate">
                          {post.title || 'Untitled Track'}
                        </p>
                        <p className="text-xs text-[#5C534A]">
                          {post.artistName || 'Unknown Artist'}
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>Shared by @{post.authorUsername}</span>
                          {post.authorIsVerifiedArtist && (
                            <VerifiedBadge className="ml-1" />
                          )}
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRestorePost(post.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-xs font-medium text-[#1F1B18] hover:border-[#B84A2E] cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePost(post.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#B84A2E]/30 bg-[#B84A2E]/10 text-xs font-medium text-[#9E3D24] hover:bg-[#B84A2E] hover:text-[#FCF9F4] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Tab 2: DMCA Reports & Resend Email Workflows */}
          {tab === 'dmca' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] overflow-hidden">
                <div className="border-b border-[#DDD5C7] px-5 py-3.5 flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold text-[#1F1B18]">
                    DMCA &amp; Copyright Notices
                  </h3>
                  <span className="font-mono-tabular text-xs text-[#5C534A]">
                    {overview.dmcaReports.length} notices
                  </span>
                </div>

                {overview.dmcaReports.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#5C534A]">
                    No DMCA notices have been submitted.
                  </div>
                ) : (
                  <ul className="divide-y divide-[#DDD5C7]">
                    {overview.dmcaReports.map((report) => (
                      <li key={report.id} className="px-5 py-4 space-y-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-[#1F1B18]">
                              {report.postTitle || 'Deleted Track'}
                            </p>
                            <p className="text-xs text-[#5C534A]">
                              Claimant: {report.claimantName} ({report.reporterEmail})
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span className="font-medium text-[#1F1B18]">
                                Status: {report.status.replace('_', ' ')}
                              </span>
                            </p>
                          </div>

                          {report.status === 'open' && (
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleResolveDmca(report.id, 'takedown_applied')
                                }
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#B84A2E] text-xs font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] cursor-pointer"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                                <span>Enforce Takedown</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleResolveDmca(report.id, 'dismissed', true)
                                }
                                className="px-3 py-1.5 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-xs font-medium text-[#1F1B18] hover:border-[#B84A2E] cursor-pointer"
                              >
                                Dismiss &amp; Restore
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-[#5C534A] leading-relaxed">
                          {report.reason}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Resend Email Workflow Dispatch & Audit Log */}
              <div className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] p-5 space-y-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#DDD5C7] pb-3">
                  <div>
                    <h3 className="font-display text-base font-semibold text-[#1F1B18]">
                      Resend Email Workflows
                    </h3>
                    <p className="text-xs text-[#5C534A]">
                      {overview.resendConfigured
                        ? 'RESEND_API_KEY configured — transactional DMCA and verification alerts send live.'
                        : 'RESEND_API_KEY is not set in environment — alerts are logged to email_alerts for audit.'}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[#5C534A]">
                    Admin Alert Inbox: {overview.adminAlertEmail || 'Not configured'}
                  </span>
                </div>

                <form
                  onSubmit={handleSendAlert}
                  className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
                >
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-[#1F1B18]">
                      Recipient Email
                    </span>
                    <input
                      type="email"
                      required
                      value={alertRecipient}
                      onChange={(e) => setAlertRecipient(e.target.value)}
                      className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-xs text-[#1F1B18]"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-[#1F1B18]">Subject</span>
                    <input
                      type="text"
                      required
                      value={alertSubject}
                      onChange={(e) => setAlertSubject(e.target.value)}
                      className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-xs text-[#1F1B18]"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={sendingAlert}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-[#1F1B18] text-xs font-semibold text-[#FCF9F4] hover:bg-[#B84A2E] disabled:opacity-50 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{sendingAlert ? 'Sending...' : 'Dispatch Resend Alert'}</span>
                  </button>
                  <label className="md:col-span-3 block space-y-1">
                    <span className="text-xs font-medium text-[#1F1B18]">
                      Alert Message Body
                    </span>
                    <textarea
                      rows={2}
                      required
                      value={alertBody}
                      onChange={(e) => setAlertBody(e.target.value)}
                      className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-xs text-[#1F1B18]"
                    />
                  </label>
                </form>

                <div className="border-t border-[#DDD5C7] pt-4">
                  <h4 className="text-xs font-semibold text-[#5C534A] mb-2">
                    Recent Email Alert Log
                  </h4>
                  {overview.emailAlerts.length === 0 ? (
                    <p className="text-xs text-[#5C534A]">
                      No email workflows triggered yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[#DDD5C7] text-[#5C534A]">
                            <th className="py-2 pr-3 font-medium">Type</th>
                            <th className="py-2 pr-3 font-medium">Recipient</th>
                            <th className="py-2 pr-3 font-medium">Subject</th>
                            <th className="py-2 pr-3 font-medium">Delivery</th>
                            <th className="py-2 font-medium text-right">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#DDD5C7]">
                          {overview.emailAlerts.map((log) => (
                            <tr key={log.id}>
                              <td className="py-2 pr-3 font-mono-tabular text-[#5C534A] whitespace-nowrap">
                                {log.alertType}
                              </td>
                              <td className="py-2 pr-3 text-[#1F1B18]">
                                {log.recipientEmail}
                              </td>
                              <td className="py-2 pr-3 text-[#5C534A] max-w-xs truncate">
                                {log.subject}
                              </td>
                              <td className="py-2 pr-3 font-medium whitespace-nowrap">
                                {log.deliveryStatus === 'sent'
                                  ? 'Sent (Resend)'
                                  : log.deliveryStatus === 'logged_unconfigured'
                                    ? 'Logged (No API Key)'
                                    : 'Failed'}
                              </td>
                              <td className="py-2 text-right font-mono-tabular text-[#5C534A] whitespace-nowrap">
                                {new Date(log.createdAt).toLocaleTimeString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Verified Artist Claims */}
          {tab === 'verifications' && (
            <div className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] overflow-hidden">
              <div className="border-b border-[#DDD5C7] px-5 py-3.5 flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-[#1F1B18]">
                  Verified Artist Verification Queue
                </h3>
                <span className="font-mono-tabular text-xs text-[#5C534A]">
                  {overview.verificationRequests.length} requests
                </span>
              </div>

              {overview.verificationRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#5C534A]">
                  No Verified Artist applications submitted yet.
                </div>
              ) : (
                <ul className="divide-y divide-[#DDD5C7]">
                  {overview.verificationRequests.map((req) => (
                    <li key={req.id} className="px-5 py-4 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-[#1F1B18]">
                            {req.artistName}{' '}
                            <span className="font-normal text-xs text-[#5C534A]">
                              (@{req.username})
                            </span>
                          </p>
                          <p className="text-xs text-[#5C534A]">
                            <a
                              href={req.portfolioUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#B84A2E] hover:underline"
                            >
                              {req.portfolioUrl}
                            </a>
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            <span>Status: {req.status}</span>
                          </p>
                        </div>

                        {req.status === 'pending' && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                handleReviewVerification(req.id, 'approved')
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#B84A2E] text-xs font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] cursor-pointer"
                            >
                              <BadgeCheck className="w-3.5 h-3.5" />
                              <span>Approve Badge</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleReviewVerification(req.id, 'rejected')
                              }
                              className="px-3 py-1.5 rounded-md border border-[#DDD5C7] text-xs font-medium text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                      {req.notes && (
                        <p className="text-xs text-[#5C534A]">{req.notes}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Tab 4: Invites & Member Directory */}
          {tab === 'members' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-semibold text-[#1F1B18]">
                      Invite Codes
                    </h3>
                    <p className="text-xs text-[#5C534A]">
                      Generate single-use invite codes for new SONA community members.
                    </p>
                  </div>
                  <form onSubmit={handleCreateInvite} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customInviteCode}
                      onChange={(e) => setCustomInviteCode(e.target.value)}
                      placeholder="Optional custom code..."
                      className="rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-1.5 font-mono-tabular text-xs text-[#1F1B18]"
                    />
                    <button
                      type="submit"
                      disabled={creatingInvite}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-md bg-[#B84A2E] text-xs font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Generate Invite</span>
                    </button>
                  </form>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {overview.invites.slice(0, 12).map((inv) => (
                    <div
                      key={inv.code}
                      className="flex items-center justify-between gap-2 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-mono-tabular font-semibold text-[#1F1B18] truncate">
                          {inv.code}
                        </p>
                        <p className="text-[11px] text-[#5C534A]">
                          {inv.usedBy ? 'Redeemed' : 'Available'}
                        </p>
                      </div>
                      {!inv.usedBy && (
                        <button
                          type="button"
                          onClick={() => handleCopyInvite(inv.code)}
                          aria-label={`Copy invite code ${inv.code}`}
                          className="p-1 text-[#5C534A] hover:text-[#B84A2E] cursor-pointer"
                        >
                          {copiedCode === inv.code ? (
                            <Check className="w-3.5 h-3.5 text-[#B84A2E]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] overflow-hidden">
                <div className="border-b border-[#DDD5C7] px-5 py-3.5">
                  <h3 className="font-display text-base font-semibold text-[#1F1B18]">
                    Member Directory
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#DDD5C7] bg-[#EFE9DE]/60 text-[#5C534A]">
                        <th className="py-2.5 px-4 font-medium">Member</th>
                        <th className="py-2.5 px-4 font-medium">Email</th>
                        <th className="py-2.5 px-4 font-medium">Role</th>
                        <th className="py-2.5 px-4 font-medium">Artist Status</th>
                        <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DDD5C7]">
                      {overview.members.map((member) => (
                        <tr key={member.id} className="hover:bg-[#F7F3EC]/70">
                          <td className="py-3 px-4 font-medium text-[#1F1B18] whitespace-nowrap">
                            @{member.username}
                            {member.isVerifiedArtist && (
                              <VerifiedBadge
                                artistName={member.verifiedArtistName}
                                className="ml-1"
                              />
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#5C534A]">{member.email}</td>
                          <td className="py-3 px-4 text-[#1F1B18] capitalize">
                            {member.role}
                          </td>
                          <td className="py-3 px-4 text-[#5C534A]">
                            {member.isVerifiedArtist
                              ? `Verified (${member.verifiedArtistName || member.username})`
                              : 'Listener'}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleVerifiedUser(
                                  member.id,
                                  !member.isVerifiedArtist,
                                  member.username,
                                )
                              }
                              className="px-2.5 py-1 rounded border border-[#DDD5C7] bg-[#F7F3EC] text-[11px] font-medium text-[#1F1B18] hover:border-[#B84A2E] cursor-pointer"
                            >
                              {member.isVerifiedArtist
                                ? 'Revoke Badge'
                                : 'Verify Artist'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleRole(
                                  member.id,
                                  member.role === 'admin' ? 'user' : 'admin',
                                  member.username,
                                )
                              }
                              className="px-2.5 py-1 rounded border border-[#DDD5C7] text-[11px] font-medium text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
                            >
                              {member.role === 'admin' ? 'Set User' : 'Make Admin'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

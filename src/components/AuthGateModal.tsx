import { useEffect, useState, type FormEvent } from 'react';
import { Lock, X } from 'lucide-react';

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
}

interface AuthGateModalProps {
  isOpen: boolean;
  initialTab?: 'login' | 'register';
  onClose: () => void;
  onAuthenticated: (user: SessionUser) => void;
}

export function AuthGateModal({
  isOpen,
  initialTab = 'login',
  onClose,
  onAuthenticated,
}: AuthGateModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setError(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body =
        tab === 'login'
          ? { identifier, password }
          : { username, email, password, inviteCode };

      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const rawText = await res.text();
      let data: { error?: string; user?: SessionUser } = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = {};
        }
      }

      if (!res.ok) {
        setError(
          data?.error ||
            `Authentication request failed (HTTP ${res.status}). Ensure the Express server is running and DATABASE_URL is configured.`,
        );
        return;
      }

      if (data?.user) {
        onAuthenticated(data.user);
        onClose();
      }
    } catch {
      setError(
        'Network error reaching /api/auth. Refresh the page or verify the dev server is running.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1B18]/45 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-[#DDD5C7] pb-4">
          <div>
            <p className="text-xs font-medium text-[#B84A2E]">Invite-Only Community</p>
            <h2
              id="auth-modal-title"
              className="mt-1 font-display text-2xl font-semibold text-[#1F1B18]"
            >
              {tab === 'login' ? 'Sign in to SONA' : 'Redeem Invite Code'}
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

        {/* Mode Toggle */}
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-md border border-[#DDD5C7] bg-[#EFE9DE] p-1">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
              tab === 'login'
                ? 'bg-[#FCF9F4] text-[#1F1B18] shadow-xs'
                : 'text-[#5C534A] hover:text-[#1F1B18]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
              tab === 'register'
                ? 'bg-[#FCF9F4] text-[#1F1B18] shadow-xs'
                : 'text-[#5C534A] hover:text-[#1F1B18]'
            }`}
          >
            Join with Invite
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {tab === 'login' ? (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#1F1B18]">
                Email or Username
              </span>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="analog_maya"
                className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-sm text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
              />
            </label>
          ) : (
            <>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#1F1B18]">
                  Invite Code
                </span>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="SONA-XXXX"
                  className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 font-mono-tabular text-sm text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#1F1B18]">Username</span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="analog_maya"
                  className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-sm text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#1F1B18]">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-sm text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
                />
              </label>
            </>
          )}

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#1F1B18]">Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-sm text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
            />
          </label>

          {error && (
            <p className="rounded-md border border-[#B84A2E]/30 bg-[#B84A2E]/10 px-3 py-2 text-xs text-[#9E3D24]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#B84A2E] px-4 py-2.5 text-sm font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] disabled:opacity-60 transition-colors cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>
              {submitting
                ? 'Please wait...'
                : tab === 'login'
                  ? 'Sign In'
                  : 'Create Member Account'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}

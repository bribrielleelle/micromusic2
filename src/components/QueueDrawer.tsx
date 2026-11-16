import { ArrowDown, ArrowUp, Play, Trash2, X } from 'lucide-react';
import { formatDuration, usePlayerStore } from '../store/playerStore';

export function QueueDrawer() {
  const isOpen = usePlayerStore((s) => s.queueDrawerOpen);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const setQueueDrawerOpen = usePlayerStore((s) => s.setQueueDrawerOpen);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const moveQueueItem = usePlayerStore((s) => s.moveQueueItem);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-[#1F1B18]/40"
        onClick={() => setQueueDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside
        aria-label="Up Next queue"
        className="relative z-10 w-full max-w-md h-full bg-[#FCF9F4] border-l border-[#DDD5C7] flex flex-col shadow-xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#DDD5C7] px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#1F1B18]">
              Up Next Queue
            </h2>
            <p className="text-xs text-[#5C534A]">
              Saved automatically across page refreshes
            </p>
          </div>
          <button
            type="button"
            onClick={() => setQueueDrawerOpen(false)}
            aria-label="Close queue drawer"
            className="p-1.5 text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {currentTrack && (
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-[#B84A2E]">
                Now Playing
              </p>
              <div className="rounded-lg border border-[#B84A2E]/40 bg-[#F7F3EC] p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-[#1F1B18] truncate">
                    {currentTrack.title}
                  </p>
                  <p className="text-xs text-[#5C534A] truncate">
                    {currentTrack.artistName}
                  </p>
                </div>
                <span className="font-mono-tabular text-xs text-[#5C534A] shrink-0">
                  {formatDuration(currentTrack.durationSeconds)}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-[#5C534A]">
                Up Next ({queue.length})
              </p>
              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={clearQueue}
                  className="text-xs font-medium text-[#B84A2E] hover:text-[#9E3D24] cursor-pointer"
                >
                  Clear queue
                </button>
              )}
            </div>

            {queue.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#DDD5C7] py-10 px-4 text-center">
                <p className="text-sm font-medium text-[#1F1B18]">Queue is empty.</p>
                <p className="mt-1 text-xs text-[#5C534A]">
                  Use &ldquo;Queue&rdquo; on any track card to line up listening.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#DDD5C7] rounded-lg border border-[#DDD5C7] bg-[#F7F3EC]">
                {queue.map((item, idx) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <button
                      type="button"
                      onClick={() => playTrack(item)}
                      className="flex items-center gap-3 min-w-0 text-left cursor-pointer group"
                    >
                      <span className="w-7 h-7 shrink-0 rounded border border-[#DDD5C7] bg-[#FCF9F4] flex items-center justify-center text-[#5C534A] group-hover:text-[#B84A2E]">
                        <Play className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1F1B18] truncate group-hover:text-[#B84A2E]">
                          {item.title}
                        </p>
                        <p className="text-xs text-[#5C534A] truncate">
                          {item.artistName} · {formatDuration(item.durationSeconds)}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveQueueItem(idx, idx - 1)}
                        aria-label={`Move ${item.title} up`}
                        className="p-1.5 text-[#5C534A] hover:text-[#1F1B18] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === queue.length - 1}
                        onClick={() => moveQueueItem(idx, idx + 1)}
                        aria-label={`Move ${item.title} down`}
                        className="p-1.5 text-[#5C534A] hover:text-[#1F1B18] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromQueue(item.id)}
                        aria-label={`Remove ${item.title} from queue`}
                        className="p-1.5 text-[#5C534A] hover:text-[#B84A2E] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

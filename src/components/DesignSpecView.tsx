import { BREAKPOINT_SPECS, COLOR_TOKENS } from '../design/tokens';

export function DesignSpecView() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-12">
      {/* Phase 1 Header */}
      <section className="border-b border-[#DDD5C7] pb-6">
        <p className="text-xs font-medium tracking-wide text-[#B84A2E]">
          Phase 1 · UI/UX Design &amp; Prototyping
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#1F1B18] text-balance">
          SONA Warm Vintage Design System &amp; Layout Blueprint
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5C534A]">
          Tactile record-shop warmth built on warm parchment paper, espresso ink, hairline dividers, and a disciplined 60-30-10 color allocation. Static metadata uses clean typographic separators without pill enclosures.
        </p>
      </section>

      {/* Color System */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-[#1F1B18]">
            1. Warm Vintage Palette (60-30-10)
          </h2>
          <p className="mt-1 text-sm text-[#5C534A]">
            60% parchment canvas, 30% structural linen &amp; ink, 10% terracotta focal accents.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLOR_TOKENS.map((item) => (
            <div
              key={item.token}
              className="border border-[#DDD5C7] rounded-lg bg-[#FCF9F4] overflow-hidden"
            >
              <div
                className="h-16 w-full border-b border-[#DDD5C7]"
                style={{ backgroundColor: item.hex }}
              />
              <div className="p-3.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#1F1B18]">{item.name}</span>
                  <span className="font-mono-tabular text-xs text-[#5C534A]">{item.hex}</span>
                </div>
                <p className="font-mono-tabular text-[11px] text-[#B84A2E]">{item.token}</p>
                <p className="text-xs leading-snug text-[#5C534A] pt-1">{item.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Typography Pairing */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-[#1F1B18]">
            2. Typography Hierarchy (2+1 Rule)
          </h2>
          <p className="mt-1 text-sm text-[#5C534A]">
            Editorial serif display face paired with geometric sans UI prose and tabular monospace figures.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-[#DDD5C7] rounded-lg bg-[#FCF9F4] p-5 space-y-2">
            <span className="text-xs font-medium text-[#5C534A]">Display &amp; Titles</span>
            <p className="font-display text-2xl font-semibold text-[#1F1B18]">
              Fraunces Serif
            </p>
            <p className="text-xs leading-relaxed text-[#5C534A]">
              Used for brand lockup, track titles, crate headings, and editorial section markers.
            </p>
          </div>

          <div className="border border-[#DDD5C7] rounded-lg bg-[#FCF9F4] p-5 space-y-2">
            <span className="text-xs font-medium text-[#5C534A]">UI &amp; Body Prose</span>
            <p className="text-2xl font-semibold text-[#1F1B18]">
              Plus Jakarta Sans
            </p>
            <p className="text-xs leading-relaxed text-[#5C534A]">
              Used for sidebar navigation, curator handles, search controls, and comment threads.
            </p>
          </div>

          <div className="border border-[#DDD5C7] rounded-lg bg-[#FCF9F4] p-5 space-y-2">
            <span className="text-xs font-medium text-[#5C534A]">Time &amp; Counters</span>
            <p className="font-mono-tabular text-2xl font-medium text-[#1F1B18]">
              04:18 / 128
            </p>
            <p className="text-xs leading-relaxed text-[#5C534A]">
              JetBrains Mono with tabular numerals for track durations, scrubbers, and crate counts.
            </p>
          </div>
        </div>
      </section>

      {/* Responsive Breakpoints */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-[#1F1B18]">
            3. Three-Pane Layout &amp; Responsive Breakpoints
          </h2>
          <p className="mt-1 text-sm text-[#5C534A]">
            Desktop-first three-pane workspace collapsing gracefully below the <code className="font-mono-tabular text-xs text-[#1F1B18]">lg (1024px)</code> breakpoint.
          </p>
        </div>

        <div className="border border-[#DDD5C7] rounded-lg bg-[#FCF9F4] overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#DDD5C7] bg-[#EFE9DE] text-xs font-semibold text-[#1F1B18]">
                <th className="py-3 px-4">Viewport Tier</th>
                <th className="py-3 px-4">Sidebar (Left)</th>
                <th className="py-3 px-4">Main Feed (Center)</th>
                <th className="py-3 px-4">Hero Vinyl (Right)</th>
                <th className="py-3 px-4">Persistent Footer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDD5C7] text-xs text-[#5C534A]">
              {BREAKPOINT_SPECS.map((bp) => (
                <tr key={bp.tier} className="align-top">
                  <td className="py-3.5 px-4 font-medium text-[#1F1B18] whitespace-nowrap">
                    <div>{bp.tier}</div>
                    <div className="mt-0.5 font-mono-tabular text-[11px] text-[#B84A2E]">
                      {bp.range}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 leading-relaxed">{bp.sidebar}</td>
                  <td className="py-3.5 px-4 leading-relaxed">{bp.centerFeed}</td>
                  <td className="py-3.5 px-4 leading-relaxed">{bp.heroVinyl}</td>
                  <td className="py-3.5 px-4 leading-relaxed">{bp.footerPlayer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

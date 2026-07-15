export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-52 rounded-xl mb-2" style={{ background: '#E5E7EB' }} />
          <div className="h-4 w-72 rounded-lg" style={{ background: '#F3F4F6' }} />
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl p-6" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <div className="w-12 h-12 rounded-xl mb-4" style={{ background: '#F3F4F6' }} />
            <div className="h-8 w-14 rounded-lg mb-2" style={{ background: '#F3F4F6' }} />
            <div className="h-4 w-28 rounded-lg" style={{ background: '#F9FAFB' }} />
          </div>
        ))}
      </div>

      {/* Hosting plan skeleton */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
        <div className="px-5 py-4 flex items-center gap-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="w-10 h-10 rounded-xl shrink-0" style={{ background: '#F3F4F6' }} />
          <div className="flex-1">
            <div className="h-4 w-48 rounded-lg mb-2" style={{ background: '#F3F4F6' }} />
            <div className="h-3 w-32 rounded-lg" style={{ background: '#F9FAFB' }} />
          </div>
        </div>
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="w-4 h-4 rounded" style={{ background: '#F3F4F6' }} />
          <div className="flex-1 h-2 rounded-full" style={{ background: '#F3F4F6' }} />
        </div>
      </div>

      {/* Bottom row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[0, 1].map(i => (
          <div key={i} className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <div className="h-4 w-32 rounded-lg mb-4" style={{ background: '#F3F4F6' }} />
            {[0, 1, 2, 3].map(j => (
              <div key={j} className="flex items-center justify-between py-2.5 px-3 rounded-xl mb-1">
                <div className="h-4 w-36 rounded-lg" style={{ background: '#F9FAFB' }} />
                <div className="h-4 w-8 rounded-lg" style={{ background: '#F9FAFB' }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

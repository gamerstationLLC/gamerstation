// app/tools/lol/summoner/[region]/[gameName]/[tagLine]/loading.tsx

export default function LoadingSummoner() {
  return (
    <div className="min-h-screen bg-black text-white p-6 animate-pulse">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Profile Header Skeleton */}
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-zinc-800 rounded-xl" />
          <div className="space-y-3">
            <div className="h-6 w-48 bg-zinc-800 rounded" />
            <div className="h-4 w-32 bg-zinc-800 rounded" />
          </div>
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-800 rounded-xl" />
          ))}
        </div>

        {/* Match History Skeleton */}
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-zinc-900 rounded-xl" />
          ))}
        </div>

      </div>
    </div>
  );
}

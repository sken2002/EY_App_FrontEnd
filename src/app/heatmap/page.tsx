'use client';

import { useSpiderState } from '@/hooks/useSpiderState';
import { HeatmapView } from '@/components/canvas/HeatmapView';

export default function HeatmapPage() {
  const { data, loading, error } = useSpiderState();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0f] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Loading Project Spider Data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0f] text-white">
        <p className="text-sm text-red-400">Failed to load data: {error?.message ?? 'unknown error'}</p>
      </div>
    );
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <HeatmapView nodes={data.nodes} />
    </main>
  );
}
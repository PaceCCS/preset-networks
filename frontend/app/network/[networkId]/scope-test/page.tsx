"use client";

import dynamic from "next/dynamic";

// Dynamic import with SSR disabled - useLiveQuery doesn't support server rendering
const ScopeTestContent = dynamic(() => import("./scope-test-content"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-brand-grey-2">Loading...</div>
    </div>
  ),
});

export default function ScopeTestPage() {
  return <ScopeTestContent />;
}

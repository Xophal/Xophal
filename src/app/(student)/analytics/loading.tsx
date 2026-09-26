export default function AnalyticsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your analytics</span>
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
export function PageLoading() {
  return (
    <div aria-busy="true" className="space-y-4">
      <div className="h-8 w-64 animate-pulse rounded bg-navy-100" />
      <div className="h-32 animate-pulse rounded-xl bg-surface" />
    </div>
  );
}

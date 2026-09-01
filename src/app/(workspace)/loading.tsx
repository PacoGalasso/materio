export default function WorkspaceLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true" aria-live="polite">
      <div className="bg-surface border-line h-12 border-b" />
      <div className="animate-pulse space-y-4 p-5">
        <div className="bg-surface-sunken h-20 rounded-md" />
        <div className="bg-surface-sunken h-64 rounded-md" />
        <span className="sr-only">Chargement…</span>
      </div>
    </div>
  );
}

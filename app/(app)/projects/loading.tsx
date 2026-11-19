// Shown while the server loads projects and tasks. Without it the nearest
// loading file is the dashboard's, which would flash the wrong layout here.
export default function ProjectsLoading() {
  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 rounded-lg bg-muted animate-pulse" />
        <div className="h-9 w-28 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Category columns */}
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((column) => (
          <div key={column} className="space-y-3">
            <div className="h-5 w-24 rounded bg-muted animate-pulse" />
            {[1, 2].map((card) => (
              <div key={card} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

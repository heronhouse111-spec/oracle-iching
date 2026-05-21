import Header from "@/components/Header";

export default function AdminLoading() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4 max-w-6xl mx-auto">
        <div className="space-y-6">
          <div className="h-10 w-52 rounded bg-mystic-gold/10 animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="mystic-card p-5 h-28 animate-pulse bg-gradient-to-br from-mystic-gold/5 to-transparent"
              />
            ))}
          </div>
          <div className="mystic-card p-5 h-56 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="mystic-card p-5 h-72 animate-pulse"
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

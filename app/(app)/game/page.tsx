export default function GamePage() {
  return (
    <div className="flex flex-col items-center px-2.5 pt-16 text-center">
      <div className="mb-4.5 grid h-[88px] w-[88px] rotate-[-6deg] grid-cols-2 grid-rows-2 gap-1.5 rounded-2xl border-[3px] border-ink bg-card p-3.5 shadow-card">
        <div className="h-3 w-3 justify-self-start rounded-full bg-orange" />
        <div className="h-3 w-3 justify-self-end rounded-full bg-ink" />
        <div className="h-3 w-3 justify-self-start rounded-full bg-ink" />
        <div className="h-3 w-3 justify-self-end rounded-full bg-orange" />
      </div>
      <p className="font-heading text-xl font-semibold text-ink">
        games, coming soon !!!
      </p>
    </div>
  );
}

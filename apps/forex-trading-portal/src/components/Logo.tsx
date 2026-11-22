export default function Logo({ light, compact }: { light?: boolean; compact?: boolean }) {
  const brand = light ? 'text-white' : '';
  const sub = light ? 'text-white/70' : 'text-primary';
  return (
    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
      <div className={compact ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-black text-primary-foreground sm:h-8 sm:w-8 sm:rounded-lg sm:text-sm" : "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-black text-primary-foreground sm:h-8 sm:w-8 sm:rounded-lg sm:text-sm"}>BB</div>
      <div className="min-w-0 leading-none">
        <div className={`${brand} whitespace-nowrap font-extrabold ${compact ? 'text-[9px] sm:text-sm' : 'text-[11px] sm:text-sm'}`}>BIGBULLS</div>
        <div className={`${sub} mt-0.5 whitespace-nowrap font-semibold ${compact ? 'text-[6px] tracking-[0.08em] sm:text-[9px] sm:tracking-[0.2em]' : 'text-[7px] tracking-[0.12em] sm:text-[9px] sm:tracking-[0.2em]'}`}>GLOBAL MARKET</div>
      </div>
    </div>
  );
}

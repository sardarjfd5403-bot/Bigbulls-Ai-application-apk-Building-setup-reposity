export default function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-black text-primary-foreground sm:h-8 sm:w-8 sm:rounded-lg sm:text-sm">BB</div>
      <div className="min-w-0 leading-none">
        <div className={light ? 'whitespace-nowrap text-[11px] font-extrabold text-white sm:text-sm' : 'whitespace-nowrap text-[11px] font-extrabold sm:text-sm'}>BIGBULLS</div>
        <div className={light ? 'mt-0.5 whitespace-nowrap text-[7px] font-semibold tracking-[0.12em] text-white/70 sm:text-[9px] sm:tracking-[0.2em]' : 'mt-0.5 whitespace-nowrap text-[7px] font-semibold tracking-[0.12em] text-primary sm:text-[9px] sm:tracking-[0.2em]'}>GLOBAL MARKET</div>
      </div>
    </div>
  );
}

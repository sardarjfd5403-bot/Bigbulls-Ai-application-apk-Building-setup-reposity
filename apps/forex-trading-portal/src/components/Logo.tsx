export default function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">BB</div>
      <div className="leading-none">
        <div className={light ? 'text-sm font-extrabold text-white' : 'text-sm font-extrabold'}>BIGBULLS</div>
        <div className={light ? 'text-[9px] font-semibold tracking-[0.2em] text-white/70' : 'text-[9px] font-semibold tracking-[0.2em] text-primary'}>GLOBAL MARKET</div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Search, Star } from 'lucide-react';
import { Input } from '@project/components/ui/input';
import { cn } from '@project/components/lib/utils';
import { useTrading } from '../lib/store';
import { CATEGORIES, SYMBOLS } from '../lib/symbols';

export default function Watchlist({ selected, onSelect }: { selected: string; onSelect: (s: string) => void }) {
  const { quotes, state, toggleFav } = useTrading();
  const [tab, setTab] = useState<string>('Favorites');
  const [q, setQ] = useState('');

  const list = SYMBOLS.filter((s) =>
    (q ? true : tab === 'Favorites' ? state.favorites.includes(s.symbol) : s.category === tab) &&
    (s.symbol + s.name).toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="p-3 pb-2">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Instruments</div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 pl-8" />
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto px-3 pb-2">
        {['Favorites', ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => { setTab(c); setQ(''); }} className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', tab === c && !q ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>{c}</button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-y bg-muted/50 px-3 py-1.5 text-[10px] font-bold uppercase text-muted-foreground">
        <span>Symbol</span><span className="w-[72px] text-right">Bid</span><span className="w-[72px] text-right">Ask</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No instruments</p>}
        {list.map((s) => {
          const qt = quotes[s.symbol]; const chg = ((qt.bid - qt.open) / qt.open) * 100;
          const fav = state.favorites.includes(s.symbol);
          return (
            <div key={s.symbol} onClick={() => onSelect(s.symbol)} className={cn('grid cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b px-3 py-2 hover:bg-accent', selected === s.symbol && 'bg-accent')}>
              <div className="flex min-w-0 items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); toggleFav(s.symbol); }} aria-label="Favorite">
                  <Star className={cn('h-3.5 w-3.5', fav ? 'fill-primary text-primary' : 'text-muted-foreground')} />
                </button>
                <div className="min-w-0">
                  <div className="text-sm font-bold">{s.symbol}</div>
                  <div className={cn('num text-[10px]', chg >= 0 ? 'text-up' : 'text-destructive')}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)}%</div>
                </div>
              </div>
              <span className={cn('num w-[72px] text-right text-xs font-medium', qt.dir > 0 ? 'text-up' : qt.dir < 0 ? 'text-destructive' : '')}>{qt.bid.toFixed(s.digits)}</span>
              <span className={cn('num w-[72px] text-right text-xs font-medium', qt.dir > 0 ? 'text-up' : qt.dir < 0 ? 'text-destructive' : '')}>{qt.ask.toFixed(s.digits)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Input } from '@project/components/ui/input';
import { Switch } from '@project/components/ui/switch';
import { Button } from '@project/components/ui/button';
import { cn } from '@project/components/lib/utils';
import { marginFor, useTrading, Side } from '../lib/store';
import { getSymbolInfo, money } from '../lib/symbols';

type Mode = 'Market' | 'Pending';

export default function OrderPanel({ symbol }: { symbol: string }) {
  const t = useTrading();
  const s = getSymbolInfo(symbol); const liveQuote = t.quotes?.[symbol]; const q = { bid: Number.isFinite(Number(liveQuote?.bid)) ? Number(liveQuote.bid) : s.start, ask: Number.isFinite(Number(liveQuote?.ask)) ? Number(liveQuote.ask) : s.start + s.spread };
  const [side, setSide] = useState<Side>('buy');
  const [mode, setMode] = useState<Mode>('Market');
  const [vol, setVol] = useState('0.01');
  const [price, setPrice] = useState('');
  const [useSl, setUseSl] = useState(false); const [sl, setSl] = useState('');
  const [useTp, setUseTp] = useState(false); const [tp, setTp] = useState('');

  const v = Number(vol);
  const validVol = v >= 0.01 && v <= 200;
  const margin = validVol ? marginFor(symbol, v, t.account.leverage, t.quotes) : 0;
  const missingDemoSl = t.account.type === 'Demo' && (!useSl || !sl || !(Number(sl) > 0));
  const pip = s.digits >= 3 ? Math.pow(10, -(s.digits - 1)) : Math.pow(10, -s.digits);
  const pipValue = validVol ? pip * v * s.contract : 0;
  const ref = side === 'buy' ? q.ask : q.bid;

  const submit = () => {
    if (!validVol) return;
    const slN = useSl && sl ? Number(sl) : undefined, tpN = useTp && tp ? Number(tp) : undefined;
    if (mode === 'Market') { t.openPosition({ symbol, side, volume: v, sl: slN, tp: tpN }); return; }
    const p = Number(price); if (!p) return;
    const kind = side === 'buy' ? (p < q.ask ? 'Limit' : 'Stop') : (p > q.bid ? 'Limit' : 'Stop');
    t.placePending({ symbol, side, kind, volume: v, price: p, sl: slN, tp: tpN });
    setPrice('');
  };

  const step = (d: number) => setVol(Math.max(0.01, Math.round((v + d) * 100) / 100).toFixed(2));

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 overflow-hidden p-1 sm:gap-1.5 sm:p-2">
      <div>
        <div className="flex items-center justify-between"><div className="text-xs font-extrabold sm:text-lg">{symbol}<span className="ml-2 font-normal text-muted-foreground sm:hidden">{s.name}</span></div><div className="hidden text-xs text-muted-foreground sm:block">{s.name}</div></div>
        
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setSide('sell')} className={cn('h-9 rounded-md border-2 px-2 py-0.5 text-left transition sm:h-auto sm:rounded-lg sm:p-2.5', side === 'sell' ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-destructive/30 text-destructive')}>
          <div className="text-[9px] font-bold uppercase leading-3">Sell</div><div className="num text-[11px] font-bold leading-4 sm:text-base">{q.bid.toFixed(s.digits)}</div>
        </button>
        <button onClick={() => setSide('buy')} className={cn('h-9 rounded-md border-2 px-2 py-0.5 text-left transition sm:h-auto sm:rounded-lg sm:p-2.5', side === 'buy' ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/30 text-primary')}>
          <div className="text-[9px] font-bold uppercase leading-3">Buy</div><div className="num text-[11px] font-bold leading-4 sm:text-base">{q.ask.toFixed(s.digits)}</div>
        </button>
      </div>
      <div className="num -mt-1 text-center text-[9px] leading-3 text-muted-foreground sm:-mt-2 sm:text-[11px]">Spread {((q.ask - q.bid) / pip).toFixed(1)} pips</div>
      <div className="grid grid-cols-2 rounded-md bg-muted p-0.5">
        {(['Market', 'Pending'] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={cn('rounded py-0.5 text-[10px] font-bold sm:py-1.5 sm:text-xs', mode === m ? 'bg-card shadow-sm' : 'text-muted-foreground')}>{m}</button>
        ))}
      </div>
      {mode === 'Pending' && (
        <Field label="Open price"><Input className="num" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={ref.toFixed(s.digits)} /></Field>
      )}
      <Field label="Volume (lots)">
        <div className="flex h-7 sm:h-auto">
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-r-none sm:h-10 sm:w-10" onClick={() => step(-0.01)}><Minus className="h-4 w-4" /></Button>
          <Input className={cn('num h-7 rounded-none px-1 text-center sm:h-10', !validVol && 'border-destructive')} value={vol} onChange={(e) => setVol(e.target.value)} />
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-l-none sm:h-10 sm:w-10" onClick={() => step(0.01)}><Plus className="h-4 w-4" /></Button>
        </div>
        {!validVol && <p className="mt-1 text-xs text-destructive">Volume 0.01 – 200 lots</p>}
      </Field>
      <div className="grid grid-cols-2 gap-1"><Toggle label="TP" on={useTp} setOn={setUseTp} value={tp} setValue={setTp} ph={ref.toFixed(s.digits)} />
      <Toggle label="SL" on={useSl} setOn={setUseSl} value={sl} setValue={setSl} ph={ref.toFixed(s.digits)} /></div>
      <div className="hidden space-y-1.5 rounded-lg bg-muted/60 p-3 text-xs lg:block">
        <Row k="Margin" v={money(margin)} /><Row k="Free margin" v={money(t.free)} />
        <Row k="Pip value" v={money(pipValue)} /><Row k="Leverage" v={`1:${t.account.leverage}`} />
      </div>
      {missingDemoSl && <p className="text-[9px] leading-3 text-amber-700 sm:text-xs">Demo requires a valid Stop Loss.</p>}
      <Button size="lg" disabled={!validVol || missingDemoSl} onClick={submit} className={cn('mt-auto h-7 shrink-0 bg-card text-[11px] font-bold shadow-[0_-4px_10px_rgba(0,0,0,0.08)] sm:h-11 sm:text-base', side === 'sell' && 'bg-destructive hover:bg-destructive/90')}>
        {mode === 'Market' ? `Confirm ${side === 'buy' ? 'Buy' : 'Sell'} ${vol} lots` : `Place ${side === 'buy' ? 'Buy' : 'Sell'} order`}
      </Button>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="min-w-0"><div className="mb-0.5 text-[9px] font-semibold leading-3 text-muted-foreground sm:mb-1.5 sm:text-xs">{label}</div>{children}</div>
);
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="num font-semibold">{v}</span></div>
);
function Toggle({ label, on, setOn, value, setValue, ph }: { label: string; on: boolean; setOn: (b: boolean) => void; value: string; setValue: (s: string) => void; ph: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="text-[10px] font-semibold text-muted-foreground">{label}</span><Switch checked={on} onCheckedChange={setOn} />
      {on && <Input className="num h-6 min-w-0 px-1 text-[10px] sm:h-9" value={value} onChange={(e) => setValue(e.target.value)} placeholder={ph} />}
    </div>
  );
}

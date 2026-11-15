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
    <div className="flex h-full flex-col gap-2 overflow-hidden p-2 sm:gap-4 sm:overflow-y-auto sm:p-4">
      <div>
        <div className="flex items-center justify-between"><div className="text-sm font-extrabold sm:text-lg">{symbol}</div><div className="text-[10px] text-muted-foreground sm:hidden">Fixed order panel</div></div>
        <div className="text-xs text-muted-foreground">{s.name}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setSide('sell')} className={cn('rounded-lg border-2 p-1.5 text-left transition sm:p-2.5', side === 'sell' ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-destructive/30 text-destructive')}>
          <div className="text-[10px] font-bold uppercase">Sell</div><div className="num text-xs font-bold sm:text-base">{q.bid.toFixed(s.digits)}</div>
        </button>
        <button onClick={() => setSide('buy')} className={cn('rounded-lg border-2 p-2.5 text-left transition', side === 'buy' ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/30 text-primary')}>
          <div className="text-[10px] font-bold uppercase">Buy</div><div className="num text-xs font-bold sm:text-base">{q.ask.toFixed(s.digits)}</div>
        </button>
      </div>
      <div className="num -mt-2 text-center text-[11px] text-muted-foreground">Spread {((q.ask - q.bid) / pip).toFixed(1)} pips</div>
      <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
        {(['Market', 'Pending'] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={cn('rounded-md py-1.5 text-xs font-bold', mode === m ? 'bg-card shadow-sm' : 'text-muted-foreground')}>{m}</button>
        ))}
      </div>
      {mode === 'Pending' && (
        <Field label="Open price"><Input className="num" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={ref.toFixed(s.digits)} /></Field>
      )}
      <Field label="Volume (lots)">
        <div className="flex">
          <Button variant="outline" size="icon" className="rounded-r-none" onClick={() => step(-0.01)}><Minus className="h-4 w-4" /></Button>
          <Input className={cn('num rounded-none text-center', !validVol && 'border-destructive')} value={vol} onChange={(e) => setVol(e.target.value)} />
          <Button variant="outline" size="icon" className="rounded-l-none" onClick={() => step(0.01)}><Plus className="h-4 w-4" /></Button>
        </div>
        {!validVol && <p className="mt-1 text-xs text-destructive">Volume 0.01 – 200 lots</p>}
      </Field>
      <div className="grid grid-cols-2 gap-2"><Toggle label="TP" on={useTp} setOn={setUseTp} value={tp} setValue={setTp} ph={ref.toFixed(s.digits)} />
      <Toggle label="SL" on={useSl} setOn={setUseSl} value={sl} setValue={setSl} ph={ref.toFixed(s.digits)} /></div>
      <div className="hidden space-y-1.5 rounded-lg bg-muted/60 p-3 text-xs sm:block">
        <Row k="Margin" v={money(margin)} /><Row k="Free margin" v={money(t.free)} />
        <Row k="Pip value" v={money(pipValue)} /><Row k="Leverage" v={`1:${t.account.leverage}`} />
      </div>
      {missingDemoSl && <p className="text-xs text-amber-700">Demo paper execution requires a Stop Loss. Enable Stop Loss and enter a valid price before submitting.</p>}\n      <Button size="lg" disabled={!validVol || missingDemoSl} onClick={submit} className={cn('sticky bottom-0 z-10 mt-auto h-12 shrink-0 bg-card text-base font-bold shadow-[0_-6px_16px_rgba(0,0,0,0.08)]', side === 'sell' && 'bg-destructive hover:bg-destructive/90')}>
        {mode === 'Market' ? `Confirm ${side === 'buy' ? 'Buy' : 'Sell'} ${vol} lots` : `Place ${side === 'buy' ? 'Buy' : 'Sell'} order`}
      </Button>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><div className="mb-1.5 text-xs font-semibold text-muted-foreground">{label}</div>{children}</div>
);
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="num font-semibold">{v}</span></div>
);
function Toggle({ label, on, setOn, value, setValue, ph }: { label: string; on: boolean; setOn: (b: boolean) => void; value: string; setValue: (s: string) => void; ph: string }) {
  return (
    <div>
      <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><Switch checked={on} onCheckedChange={setOn} /></div>
      {on && <Input className="num mt-1.5" value={value} onChange={(e) => setValue(e.target.value)} placeholder={ph} />}
    </div>
  );
}

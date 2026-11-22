import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Input } from '@project/components/ui/input';
import { Switch } from '@project/components/ui/switch';
import { Button } from '@project/components/ui/button';
import { cn } from '@project/components/lib/utils';
import { marginFor, useTrading, Side } from '../lib/store';
import { SYM, money } from '../lib/symbols';
import AIAutoTradeControl from './AIAutoTradeControl';

type Mode = 'Market' | 'Pending';

export default function OrderPanel({ symbol }: { symbol: string }) {
  const t = useTrading();
  const s = SYM[symbol]; const q = t.quotes[symbol];
  const [side, setSide] = useState<Side>('buy');
  const [mode, setMode] = useState<Mode>('Market');
  const [vol, setVol] = useState('0.01');
  const [price, setPrice] = useState('');
  const [useSl, setUseSl] = useState(false); const [sl, setSl] = useState('');
  const [useTp, setUseTp] = useState(false); const [tp, setTp] = useState('');

  const v = Number(vol);
  const validVol = Number.isFinite(v) && v >= 0.01 && v <= 200;
  const margin = validVol ? marginFor(symbol, v, t.account.leverage, t.quotes) : 0;
  const missingDemoSl = t.account.type === 'Demo' && (!useSl || !sl || !(Number(sl) > 0));
  const pip = s.digits >= 3 ? Math.pow(10, -(s.digits - 1)) : Math.pow(10, -s.digits);
  const pipValue = validVol ? pip * v * s.contract : 0;
  const ref = side === 'buy' ? q.ask : q.bid;

  const submit = (orderSide: Side = side) => {
    if (!validVol || t.busy || !t.account.id) return;
    const slN = useSl && sl ? Number(sl) : undefined, tpN = useTp && tp ? Number(tp) : undefined;
    if (useSl && (!slN || !Number.isFinite(slN))) return;
    if (useTp && (!tpN || !Number.isFinite(tpN))) return;
    if (mode === 'Market') {
      void t.openPosition({ symbol, side: orderSide, volume: v, sl: slN, tp: tpN });
      return;
    }
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return;
    const kind = orderSide === 'buy' ? (p < q.ask ? 'Limit' : 'Stop') : (p > q.bid ? 'Limit' : 'Stop');
    void t.placePending({ symbol, side: orderSide, kind, volume: v, price: p, sl: slN, tp: tpN });
    setPrice('');
  };

  const step = (d: number) => {
    const current = Number.isFinite(v) ? v : 0.01;
    setVol(Math.min(200, Math.max(0.01, Math.round((current + d) * 100) / 100)).toFixed(2));
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-4">
      <div>
        <div className="text-lg font-extrabold">{symbol}</div>
        <div className="text-xs text-muted-foreground">{s.name}</div>
      </div>
      <AIAutoTradeControl />
      <div className="grid grid-cols-[minmax(0,1fr)_112px_minmax(0,1fr)] items-stretch gap-1.5 sm:gap-2">
        <button type="button" disabled={t.busy || !t.account.id || !validVol || missingDemoSl || (mode === 'Pending' && !(Number(price) > 0))} onClick={() => { setSide('sell'); if (mode === 'Market') submit('sell'); }} className={cn('min-w-0 rounded-lg border-2 p-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 sm:p-2.5', side === 'sell' ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-destructive/30 text-destructive')}>
          <div className="text-[10px] font-bold uppercase">{mode === 'Market' ? 'Sell' : 'Sell'}</div><div className="num truncate text-sm font-bold sm:text-base">{q.bid.toFixed(s.digits)}</div>
          {mode === 'Market' && <div className="mt-1 text-[10px] font-semibold">{t.busy && side === 'sell' ? 'Sending…' : 'SELL NOW'}</div>}
        </button>
        <div className="flex min-w-0 flex-col justify-center gap-1">
          <div className="text-center text-[10px] font-semibold text-muted-foreground">LOTS</div>
          <div className="flex items-center gap-0.5">
            <Button type="button" variant="outline" size="icon" className="h-8 w-7 shrink-0 p-0" disabled={t.busy || v <= 0.01} onClick={() => step(-0.01)} aria-label="Decrease lot size"><Minus className="h-3 w-3"/></Button>
            <Input aria-label="Volume in lots" inputMode="decimal" className={cn('num h-8 min-w-0 rounded-md px-1 text-center text-xs', !validVol && 'border-destructive')} value={vol} onChange={(e) => setVol(e.target.value)} />
            <Button type="button" variant="outline" size="icon" className="h-8 w-7 shrink-0 p-0" disabled={t.busy || v >= 200} onClick={() => step(0.01)} aria-label="Increase lot size"><Plus className="h-3 w-3"/></Button>
          </div>
          {!validVol && <p className="text-center text-[9px] text-destructive">0.01–200</p>}
        </div>
        <button type="button" disabled={t.busy || !t.account.id || !validVol || missingDemoSl || (mode === 'Pending' && !(Number(price) > 0))} onClick={() => { setSide('buy'); if (mode === 'Market') submit('buy'); }} className={cn('min-w-0 rounded-lg border-2 p-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 sm:p-2.5', side === 'buy' ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/30 text-primary')}>
          <div className="text-[10px] font-bold uppercase">Buy</div><div className="num truncate text-sm font-bold sm:text-base">{q.ask.toFixed(s.digits)}</div>
          {mode === 'Market' && <div className="mt-1 text-[10px] font-semibold">{t.busy && side === 'buy' ? 'Sending…' : 'BUY NOW'}</div>}
        </button>
      </div>
      <div className="num -mt-1 text-center text-[11px] text-muted-foreground">Spread {((q.ask - q.bid) / pip).toFixed(1)} pips</div>
      <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
        {(['Market', 'Pending'] as Mode[]).map((m) => (
          <button type="button" key={m} onClick={() => setMode(m)} className={cn('rounded-md py-1.5 text-xs font-bold', mode === m ? 'bg-card shadow-sm' : 'text-muted-foreground')}>{m}</button>
        ))}
      </div>
      {mode === 'Pending' && (
        <Field label="Open price"><Input className="num" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={ref.toFixed(s.digits)} /></Field>
      )}
      <Toggle label="Take Profit" on={useTp} setOn={setUseTp} value={tp} setValue={setTp} ph={ref.toFixed(s.digits)} />
      <Toggle label="Stop Loss" on={useSl} setOn={setUseSl} value={sl} setValue={setSl} ph={ref.toFixed(s.digits)} />
      {missingDemoSl && <p className="text-xs text-amber-700">Demo paper execution requires a Stop Loss. Enable Stop Loss and enter a valid price before submitting.</p>}
      <div className="space-y-1.5 rounded-lg bg-muted/60 p-3 text-xs">
        <Row k="Margin" v={money(margin)} /><Row k="Free margin" v={money(t.free)} />
        <Row k="Pip value" v={money(pipValue)} /><Row k="Leverage" v={`1:${t.account.leverage}`} />
      </div>
      {mode === 'Pending' && <Button size="lg" disabled={!validVol || !t.account.id || t.busy || missingDemoSl || !(Number(price) > 0)} onClick={() => submit()} className="mt-auto h-12 text-base font-bold">Place {side === 'buy' ? 'Buy' : 'Sell'} pending order · {vol} lots</Button>}
      {mode === 'Market' && <p className="mt-auto text-center text-[11px] text-muted-foreground">{t.busy ? 'Sending order securely…' : 'Tap BUY or SELL to execute immediately'}</p>}
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
      {on && <Input className="num mt-1.5" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={ph} />}
    </div>
  );
}

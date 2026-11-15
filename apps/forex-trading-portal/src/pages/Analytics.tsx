import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@project/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { useTrading } from '../lib/store';
import { fmt, money } from '../lib/symbols';

export default function Analytics() {
  const t = useTrading();
  const [acc, setAcc] = useState('all');
  const trades = useMemo(() => t.state.history.filter((h) => acc === 'all' || h.accountId === acc).sort((a, b) => a.closeTime - b.closeTime), [t.state.history, acc]);

  const stats = useMemo(() => {
    let run = 0;
    const curve = trades.map((x) => ({ time: format(x.closeTime, 'MMM d HH:mm'), pnl: Math.round((run += x.profit) * 100) / 100 }));
    const wins = trades.filter((x) => x.profit > 0);
    const bySym: Record<string, number> = {};
    trades.forEach((x) => (bySym[x.symbol] = (bySym[x.symbol] ?? 0) + x.profit));
    return {
      curve, net: run, count: trades.length,
      winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
      lots: trades.reduce((a, x) => a + x.volume, 0),
      best: Math.max(0, ...trades.map((x) => x.profit)),
      gross: wins.reduce((a, x) => a + x.profit, 0),
      loss: trades.filter((x) => x.profit < 0).reduce((a, x) => a + x.profit, 0),
      buys: trades.filter((x) => x.side === 'buy').length,
      bySym: Object.entries(bySym).map(([symbol, profit]) => ({ symbol, profit: Math.round(profit * 100) / 100 })),
    };
  }, [trades]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-extrabold tracking-tight">Performance</h1><p className="mt-1 text-sm text-muted-foreground">Results from your closed trades.</p></div>
        <Select value={acc} onValueChange={setAcc}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All accounts</SelectItem>{t.state.accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.type} #{a.number}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi l="Net profit" v={money(stats.net)} tone={stats.net} /><Kpi l="Closed trades" v={String(stats.count)} />
        <Kpi l="Win rate" v={`${stats.winRate.toFixed(1)}%`} /><Kpi l="Volume traded" v={`${fmt(stats.lots)} lots`} /><Kpi l="Best trade" v={money(stats.best)} />
        <Kpi l="Total profit" v={money(stats.gross)} tone={1} /><Kpi l="Total loss" v={money(stats.loss)} tone={-1} />
        <Kpi l="Winning trades" v={String(Math.round(stats.winRate * stats.count / 100))} /><Kpi l="Buy / Sell" v={`${stats.buys} / ${stats.count - stats.buys}`} /><Kpi l="Avg per trade" v={money(stats.count ? stats.net / stats.count : 0)} tone={stats.net} />
      </div>
      {stats.count === 0 ? <Card className="mt-4 p-10 text-center text-muted-foreground">No closed trades on this account yet. Open the terminal to start trading.</Card> : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-5"><div className="mb-3 font-bold">Cumulative profit</div>
            <div className="h-64"><ResponsiveContainer><AreaChart data={stats.curve}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} /></linearGradient></defs>
              <XAxis dataKey="time" fontSize={10} tickLine={false} axisLine={false} /><YAxis fontSize={10} tickLine={false} axisLine={false} /><Tooltip />
              <Area dataKey="pnl" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#g)" />
            </AreaChart></ResponsiveContainer></div></Card>
          <Card className="p-5"><div className="mb-3 font-bold">Profit by instrument</div>
            <div className="h-64"><ResponsiveContainer><BarChart data={stats.bySym}>
              <XAxis dataKey="symbol" fontSize={10} tickLine={false} axisLine={false} /><YAxis fontSize={10} tickLine={false} axisLine={false} /><Tooltip />
              <Bar dataKey="profit" radius={[6, 6, 0, 0]}>{stats.bySym.map((s) => <Cell key={s.symbol} fill={s.profit >= 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-3))'} />)}</Bar>
            </BarChart></ResponsiveContainer></div></Card>
        </div>
      )}
    </div>
  );
}

const Kpi = ({ l, v, tone }: { l: string; v: string; tone?: number }) => (
  <Card className="p-5"><div className="text-xs font-semibold text-muted-foreground">{l}</div><div className={`num mt-1 text-xl font-extrabold ${tone === undefined ? '' : tone >= 0 ? 'text-up' : 'text-destructive'}`}>{v}</div></Card>
);

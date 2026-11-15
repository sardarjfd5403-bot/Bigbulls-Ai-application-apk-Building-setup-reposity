import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { Wallet, LayoutGrid, LogOut, CandlestickChart, PieChart, UserCircle, AlertTriangle } from 'lucide-react';
import { logout, useAuth } from '../lib/previewAuth';
import { Button } from '@project/components/ui/button';
import { cn } from '@project/components/lib/utils';
import Logo from './Logo';
import { usePortal } from '../lib/portal';
import { money } from '../lib/symbols';

type Section = { key: string; label: string; icon: typeof Wallet; to: string; subs: { to: string; label: string }[] };
const SECTIONS: Section[] = [
  { key: 'accounts', label: 'Accounts', icon: LayoutGrid, to: '/', subs: [
    { to: '/', label: 'My accounts' }, { to: '/deposit', label: 'Deposit' }, { to: '/withdraw', label: 'Withdrawal' },
    { to: '/transfer', label: 'Transfer' }, { to: '/history', label: 'Transaction history' }, { to: '/trades', label: 'Trade history' },
  ] },
  { key: 'trade', label: 'Trade', icon: CandlestickChart, to: '/terminal', subs: [] },
  { key: 'performance', label: 'Performance', icon: PieChart, to: '/analytics', subs: [] },
  { key: 'profile', label: 'Profile', icon: UserCircle, to: '/wallet', subs: [
    { to: '/wallet', label: 'Wallet' }, { to: '/verification', label: 'KYC verification' }, { to: '/profile', label: 'Settings & security' },
    { to: '/partner', label: 'IB / Partner' }, { to: '/support', label: 'Support' },
  ] },
];
const sectionOf = (path: string) => SECTIONS.find((s) => s.subs.some((x) => x.to === path) || s.to === path) ?? SECTIONS[0];

export default function Layout() {
  const { user } = useAuth(); const p = usePortal(); const { pathname } = useLocation();
  const current = sectionOf(pathname);
  const name = p.profile.firstName ? `${p.profile.firstName} ${p.profile.lastName}` : user?.name || user?.email;

  const tabLink = (s: Section, mobile?: boolean) => (
    <Link key={s.key} to={s.to} className={cn(
      mobile ? 'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold' : 'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition',
      current.key === s.key
        ? (mobile ? 'text-primary' : 'bg-[hsl(var(--sidebar-primary))] text-white')
        : (mobile ? 'text-muted-foreground' : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]'),
    )}>
      <s.icon className={mobile ? 'h-5 w-5' : 'h-5 w-5'} />{s.label}
      {s.key === 'profile' && !p.verified && !mobile && <span className="ml-auto h-2 w-2 rounded-full bg-white/70" />}
    </Link>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[hsl(var(--sidebar-background))] p-4 md:flex">
        <div className="mb-8 px-2"><Logo light /></div>
        <nav className="space-y-1">{SECTIONS.map((s) => tabLink(s))}</nav>
        <Link to="/wallet" className="mt-auto rounded-xl bg-[hsl(var(--sidebar-accent))] p-4 text-white">
          <div className="flex items-center gap-2 text-xs text-white/60"><Wallet className="h-4 w-4" />Wallet balance</div>
          <div className="num mt-1 text-xl font-extrabold">{money(p.wallet)}</div>
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 md:px-8">
            <div className="md:hidden"><Logo /></div>
            <h2 className="hidden text-lg font-extrabold md:block">{current.label}</h2>
            <div className="ml-auto flex items-center gap-3">
              <Button asChild><Link to="/terminal"><CandlestickChart className="mr-2 h-4 w-4" />Trade</Link></Button>
              <Link to="/profile" className="hidden items-center gap-2 sm:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{(name ?? '?')[0]?.toUpperCase()}</div>
                <div><div className="text-sm font-bold leading-tight">{name}</div><div className={cn('text-[11px] font-semibold', p.verified ? 'text-up' : 'text-muted-foreground')}>{p.level}</div></div>
              </Link>
              <Button variant="ghost" size="icon" onClick={() => logout()} aria-label="Log out"><LogOut className="h-4 w-4" /></Button>
            </div>
          </div>
          {current.subs.length > 0 && (
            <nav className="flex gap-1 overflow-x-auto px-2 md:px-6">
              {current.subs.map((n) => (
                <NavLink key={n.to} to={n.to} end className={({ isActive }) => cn('whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-bold', isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{n.label}</NavLink>
              ))}
            </nav>
          )}
        </header>
        {!p.verified && (
          <div className="flex items-center gap-3 border-b bg-accent px-4 py-2.5 text-sm md:px-8">
            <AlertTriangle className="h-4 w-4 shrink-0 text-primary" />
            <span className="flex-1 text-accent-foreground">Complete KYC verification to remove deposit limits and enable withdrawals.</span>
            <Button asChild size="sm" variant="outline"><Link to="/verification">Verify now</Link></Button>
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8"><Outlet /></main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-card md:hidden">{SECTIONS.map((s) => tabLink(s, true))}</nav>
    </div>
  );
}

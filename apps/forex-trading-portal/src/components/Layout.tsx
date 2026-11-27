import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutGrid, LogOut, CandlestickChart, PieChart, UserCircle, Settings, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, History, ShieldCheck, BrainCircuit, Wallet, Headphones } from 'lucide-react';
import { logout, useAuth } from '../lib/previewAuth';
import { Button } from '@project/components/ui/button';
import { cn } from '@project/components/lib/utils';
import Logo from './Logo';
import { usePortal } from '../lib/portal';
import { useTrading } from '../lib/store';
import { money } from '../lib/symbols';

const MAIN = [
  { label: 'Accounts', to: '/', icon: LayoutGrid },
  { label: 'Trade', to: '/terminal', icon: CandlestickChart },
  { label: 'BB AI', to: '/ai', icon: BrainCircuit },
  { label: 'Performance', to: '/analytics', icon: PieChart },
  { label: 'Profile', to: '/profile', icon: UserCircle },
];
const SUB = [
  { label: 'My accounts', to: '/', icon: LayoutGrid },
  { label: 'Deposit', to: '/deposit', icon: ArrowDownToLine },
  { label: 'Withdrawal', to: '/withdraw', icon: ArrowUpFromLine },
  { label: 'Transfer', to: '/transfer', icon: ArrowLeftRight },
  { label: 'Activity', to: '/history', icon: History },
  { label: 'Wallet', to: '/wallet', icon: Wallet },
  { label: 'Support', to: '/support', icon: Headphones },
];
const isCurrent = (path: string, to: string) => to === '/' ? path === '/' : path === to || path.startsWith(to + '/');

export default function Layout() {
  const { user } = useAuth();
  const portal = usePortal();
  const trading = useTrading();
  const { pathname } = useLocation();
  const name = portal.profile.firstName
    ? `${portal.profile.firstName} ${portal.profile.lastName}`.trim()
    : user?.name || user?.email || 'Client';
  const account = trading.account;
  const active = MAIN.find(x => isCurrent(pathname, x.to)) || MAIN[0];

  return (
    <div className="bb-portal min-h-[100dvh] bg-[#F5F7FB] text-[#172033]">
      <header className="sticky top-0 z-30 border-b border-[#E7EBF2] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[66px] max-w-[1180px] items-center gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="BIGBULLS home" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0066FF] text-[13px] font-black tracking-tight text-white shadow-sm">BB</span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-black tracking-[.045em] text-[#172033]">BIGBULLS GLOBAL MARKET</span>
              <span className="block text-[9px] font-bold tracking-[.18em] text-[#7B8798]">CLIENT PORTAL</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden rounded-full border border-[#E7EBF2] bg-[#F8FAFD] px-3 py-2 sm:block">
              <div className="flex items-center gap-2">
                <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-white', account.type === 'Real' ? 'bg-[#0066FF]' : 'bg-[#0E9F6E]')}>{account.type.toUpperCase()}</span>
                <span className="num text-xs font-extrabold text-[#172033]">{money(trading.equity)}</span>
              </div>
            </div>
            <Link to="/profile" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E7EBF2] bg-white text-[#536176]" aria-label="Settings and profile">
              <Settings className="h-4 w-4" />
            </Link>
            <Button variant="ghost" size="icon" onClick={() => logout()} aria-label="Log out" className="h-9 w-9 rounded-full text-[#66748A] hover:bg-[#F0F4FA]">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-[1180px] gap-1 px-4 pb-3 sm:flex sm:px-6">
          {MAIN.map(item => {
            const Icon = item.icon;
            const selected = isCurrent(pathname, item.to);
            return <Link key={item.to} to={item.to} className={cn('flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition', selected ? 'bg-[#EAF1FF] text-[#0066FF]' : 'text-[#718096] hover:bg-[#F5F7FB] hover:text-[#172033]')}><Icon className="h-4 w-4"/>{item.label}</Link>;
          })}
        </nav>
      </header>

      <div className="mx-auto min-h-[calc(100dvh-66px)] max-w-[1180px] px-3 pb-24 pt-4 sm:px-6 sm:pt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#8A96A8]">Client workspace</div>
            <h1 className="mt-0.5 truncate text-lg font-black tracking-tight text-[#172033] sm:text-xl">{active.label === 'Accounts' ? 'My accounts' : active.label}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-[#E7EBF2] bg-white px-3 py-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF1FF] text-[#0066FF]"><UserCircle className="h-4 w-4"/></span>
            <span className="hidden max-w-[150px] truncate text-xs font-bold text-[#354258] sm:block">{name}</span>
            {!portal.verified && <span title="Verification pending" className="h-2 w-2 rounded-full bg-amber-400"/>}
          </div>
        </div>

        {pathname !== '/profile' && pathname !== '/verification' && pathname !== '/ai' && (
          <nav className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-[#E7EBF2] bg-white p-1.5 shadow-[0_2px_10px_rgba(18,36,66,.03)]">
            {SUB.map(item => {
              const Icon = item.icon;
              const selected = isCurrent(pathname, item.to);
              return <NavLink key={item.to} to={item.to} end={item.to === '/'} className={cn('flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-extrabold transition sm:px-4', selected ? 'bg-[#0066FF] text-white shadow-sm' : 'text-[#718096] hover:bg-[#F4F7FC] hover:text-[#172033]')}><Icon className="h-3.5 w-3.5"/>{item.label}</NavLink>;
            })}
          </nav>
        )}

        {!portal.loading && !portal.verified && (
          <Link to="/verification" className="mb-5 flex items-center gap-3 rounded-2xl border border-[#F3D89A] bg-[#FFFAEB] px-4 py-3 text-xs font-semibold text-[#805B12]">
            <ShieldCheck className="h-4 w-4 shrink-0"/><span className="flex-1">Complete identity verification to unlock eligible account features.</span><span className="font-extrabold text-[#0066FF]">Verify now</span>
          </Link>
        )}
        <main className="min-w-0"><Outlet /></main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#E7EBF2] bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-5px_24px_rgba(20,40,70,.06)] backdrop-blur sm:hidden">
        {MAIN.map(item => {
          const Icon = item.icon;
          const selected = isCurrent(pathname, item.to);
          return <Link key={item.to} to={item.to} className={cn('flex flex-col items-center gap-1 rounded-xl py-1.5 text-[9px] font-extrabold', selected ? 'text-[#0066FF]' : 'text-[#8994A5]')}><span className={cn('flex h-8 w-9 items-center justify-center rounded-xl', selected && 'bg-[#EAF1FF]')}><Icon className="h-[18px] w-[18px]"/></span>{item.label}</Link>;
        })}
      </nav>
    </div>
  );
}

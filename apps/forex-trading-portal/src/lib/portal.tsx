import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { toast } from 'sonner';
import { bigbullsBackend } from './bigbullsBackend';
import { supabase } from './supabase';

export type KycStatus = 'Not started' | 'Under review' | 'Verified' | 'Rejected';
export type KycStep = 'email' | 'phone' | 'profile' | 'identity' | 'address';
export type Profile = { firstName: string; lastName: string; phone: string; country: string; dob: string; city: string; address: string; postal: string };
export type WalletTxn = { id: string; type: 'Credit' | 'Debit'; note: string; amount: number; time: number };
export type Ticket = { id: string; subject: string; category: string; message: string; status: 'Open' | 'Answered' | 'Closed'; time: number };
export type IbClient = { id: string; name: string; country: string; joined: number; lots: number; commission: number; status: 'Active' | 'Inactive' };

type State = {
  profile: Profile;
  kyc: Record<KycStep, KycStatus>;
  docs: Partial<Record<'identity' | 'address', { url: string; docType: string }>>;
  wallet: number;
  walletTxns: WalletTxn[];
  twoFA: boolean;
  notify: { email: boolean; push: boolean; news: boolean };
  terminal: { oneClick: boolean; confirmClose: boolean; sounds: boolean };
  ib: { joined: boolean; code: string; clients: IbClient[]; paid: number };
  tickets: Ticket[];
  kycRecord: any | null;
  loading: boolean;
};

const COUNTRIES = ['Pakistan', 'UAE', 'India', 'Bangladesh', 'Nigeria', 'Egypt', 'UK', 'Malaysia'];
const initial = (): State => ({
  profile: { firstName: '', lastName: '', phone: '', country: 'Pakistan', dob: '', city: '', address: '', postal: '' },
  kyc: { email: 'Verified', phone: 'Not started', profile: 'Not started', identity: 'Not started', address: 'Not started' },
  docs: {}, wallet: 0, walletTxns: [], twoFA: false,
  notify: { email: true, push: true, news: false },
  terminal: { oneClick: false, confirmClose: true, sounds: true },
  ib: { joined: false, code: '', clients: [], paid: 0 }, tickets: [], kycRecord: null, loading: true,
});

const normalizeKyc = (status: unknown): KycStatus => {
  const s = String(status || '').trim().toLowerCase();
  if (['approved', 'verified', 'complete', 'completed'].includes(s)) return 'Verified';
  if (['pending', 'under_review', 'in_review', 'processing'].includes(s)) return 'Under review';
  if (['rejected', 'declined', 'not_verified'].includes(s)) return 'Rejected';
  return 'Not started';
};

function usePortalState() {
  const [s, set] = useState<State>(() => {
    const base = initial();
    try {
      const raw = localStorage.getItem('bigbulls-portal-settings-v2');
      if (raw) {
        const saved = JSON.parse(raw);
        return { ...base, twoFA: Boolean(saved.twoFA), notify: { ...base.notify, ...saved.notify }, terminal: { ...base.terminal, ...saved.terminal } };
      }
    } catch { /* use safe defaults */ }
    return base;
  });

  const loadServerState = useCallback(async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) { set(x => ({ ...x, loading: false })); return; }
    const [kycResult, profileResult, walletResult] = await Promise.allSettled([
      bigbullsBackend.kyc(), bigbullsBackend.profile(), bigbullsBackend.walletBalance(),
    ]);
    if (kycResult.status === 'rejected') throw kycResult.reason;
    const kyc = kycResult.value;
    const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
    const wallet = walletResult.status === 'fulfilled' ? Number(walletResult.value || 0) : 0;
    const status = normalizeKyc(kyc?.status);
    const fullName = String(kyc?.legal_name || profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || '');
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    set(old => ({
      ...old,
      loading: false,
      kycRecord: kyc || null,
      wallet,
      profile: {
        ...old.profile,
        firstName: String(kyc?.first_name || parts[0] || ''),
        lastName: String(kyc?.last_name || parts.slice(1).join(' ') || ''),
        phone: String(profile?.phone || ''),
        country: String(kyc?.country || profile?.country || old.profile.country),
        dob: String(kyc?.date_of_birth || ''),
        address: String(kyc?.residential_address || ''),
      },
      kyc: {
        ...old.kyc,
        profile: status === 'Verified' ? 'Verified' : (status === 'Rejected' ? 'Rejected' : old.kyc.profile),
        identity: status,
        address: status,
      },
    }));
  }, []);

  useEffect(() => {
    let alive = true;
    const run = () => { void loadServerState().catch(e => { console.error('BIGBULLS portal hydration failed', e); if (alive) set(x => ({ ...x, loading: false })); }); };
    run();
    let channel: any;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive || !data.user) return;
      channel = bigbullsBackend.subscribeClientData(data.user.id, run);
    }).catch(() => {});
    const { data: auth } = supabase.auth.onAuthStateChange(() => { if (alive) run(); });
    return () => { alive = false; auth.subscription.unsubscribe(); if (channel) void supabase.removeChannel(channel); };
  }, [loadServerState]);

  useEffect(() => {
    try { localStorage.setItem('bigbulls-portal-settings-v2', JSON.stringify({ twoFA: s.twoFA, notify: s.notify, terminal: s.terminal })); } catch { /* storage can be disabled */ }
  }, [s.twoFA, s.notify, s.terminal]);

  const verified = s.kyc.identity === 'Verified';
  const level = verified ? 'Fully verified' : s.kyc.identity === 'Under review' ? 'Verification pending' : 'Unverified';
  const ibEarned = s.ib.clients.reduce((a, c) => a + c.commission, 0);
  return {
    ...s, verified, level, ibEarned,
    refresh: loadServerState,
    saveProfile: (p: Profile) => set(x => ({ ...x, profile: p })),
    submitDoc: (step: 'identity' | 'address', url: string, docType: string) => set(x => ({ ...x, docs: { ...x.docs, [step]: { url, docType } } })),
    walletCredit: () => toast.error('Wallet credits are controlled by BIGBULLS back-office approvals.'),
    walletDebit: () => toast.error('Wallet debits must use the existing BIGBULLS server workflow.'),
    setTwoFA: (v: boolean) => set(x => ({ ...x, twoFA: v })),
    setNotify: (k: keyof State['notify'], v: boolean) => set(x => ({ ...x, notify: { ...x.notify, [k]: v } })),
    setTerminal: (k: keyof State['terminal'], v: boolean) => set(x => ({ ...x, terminal: { ...x.terminal, [k]: v } })),
    joinIb: () => toast.error('IB registration must be completed through the BIGBULLS partner workflow.'),
    withdrawCommission: () => toast.error('IB commission payouts are controlled by BIGBULLS back office.'),
    createTicket: () => toast.error('Create support requests from the live Support page.'),
    closeTicket: () => toast.error('Ticket status is controlled by BIGBULLS support staff.'),
  };
}

type Portal = ReturnType<typeof usePortalState>;
const Ctx = createContext<Portal | null>(null);
export function PortalProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={usePortalState()}>{children}</Ctx.Provider>;
}
export const usePortal = () => { const c = useContext(Ctx); if (!c) throw new Error('usePortal outside provider'); return c; };
export { COUNTRIES };

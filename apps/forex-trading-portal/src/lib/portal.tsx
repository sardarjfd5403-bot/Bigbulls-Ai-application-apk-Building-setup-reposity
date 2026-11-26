import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { supabase } from './supabase';
import { bigbullsBackend } from './bigbullsBackend';

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
  ib: { joined: boolean; code: string; clients: IbClient[]; paid: number; earned: number };
  tickets: Ticket[];
};

const emptyProfile: Profile = { firstName: '', lastName: '', phone: '', country: 'Pakistan', dob: '', city: '', address: '', postal: '' };
const defaults = (): State => ({
  profile: emptyProfile,
  kyc: { email: 'Not started', phone: 'Not started', profile: 'Not started', identity: 'Not started', address: 'Not started' },
  docs: {}, wallet: 0, walletTxns: [], twoFA: false,
  notify: { email: true, push: true, news: false },
  terminal: { oneClick: false, confirmClose: true, sounds: true },
  ib: { joined: false, code: '', clients: [], paid: 0, earned: 0 }, tickets: [],
});
const PREF_KEY = 'bigbulls-device-preferences-v2';
const COUNTRIES = ['Pakistan', 'UAE', 'India', 'Bangladesh', 'Nigeria', 'Egypt', 'UK', 'Malaysia'];

function mapStatus(status?: string | null): KycStatus {
  if (status === 'approved' || status === 'verified') return 'Verified';
  if (status === 'pending' || status === 'under_review') return 'Under review';
  if (status === 'rejected') return 'Rejected';
  return 'Not started';
}

function usePortalState() {
  const [s, set] = useState<State>(() => {
    const base = defaults();
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      return { ...base, notify: { ...base.notify, ...(saved.notify || {}) }, terminal: { ...base.terminal, ...(saved.terminal || {}) } };
    } catch { return base; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const load = async (user: any) => {
      if (!user) {
        if (alive) { set(defaults()); setLoading(false); }
        return;
      }
      const [profileR, kycR, walletR, ledgerR, partnerR, ticketsR, mfaR] = await Promise.allSettled([
        bigbullsBackend.profile(),
        bigbullsBackend.kyc(),
        bigbullsBackend.walletBalance(),
        bigbullsBackend.walletLedger(),
        bigbullsBackend.partnerDashboard(),
        bigbullsBackend.supportTickets(),
        bigbullsBackend.assuranceLevel(),
      ]);
      if (!alive) return;
      const profile = profileR.status === 'fulfilled' ? profileR.value : null;
      const kyc = kycR.status === 'fulfilled' ? kycR.value : null;
      const wallet = walletR.status === 'fulfilled' ? Number(walletR.value || 0) : 0;
      const ledger = ledgerR.status === 'fulfilled' ? ledgerR.value : [];
      const partner = partnerR.status === 'fulfilled' ? partnerR.value : null;
      const tickets = ticketsR.status === 'fulfilled' ? ticketsR.value : [];
      const mfa = mfaR.status === 'fulfilled' ? mfaR.value : null;
      const names = String(profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || '').trim().split(/\s+/);
      const kycStatus = mapStatus(kyc?.status);
      const profileValue: Profile = {
        firstName: names[0] || '', lastName: names.slice(1).join(' '), phone: profile?.phone || '',
        country: profile?.country || kyc?.country || 'Pakistan', dob: kyc?.date_of_birth || '',
        city: '', address: kyc?.residential_address || '', postal: '',
      };
      const referrals = partner?.referrals || [];
      const commissions = partner?.commissions || [];
      const partnerWallet: any = partner?.wallet || {};
      const next: Partial<State> = {
        profile: profileValue,
        kyc: {
          email: user.email_confirmed_at ? 'Verified' : 'Under review',
          phone: profile?.phone ? 'Verified' : 'Not started',
          profile: kycStatus,
          identity: kycStatus,
          address: kycStatus,
        },
        docs: kyc ? { identity: { url: kyc.document_front_path || '', docType: kyc.document_type || '' } } : {},
        wallet,
        walletTxns: (ledger || []).map((x: any) => ({
          id: x.id, type: x.direction === 'debit' ? 'Debit' : 'Credit',
          note: x.note || x.entry_type || 'Wallet activity', amount: Number(x.amount || 0),
          time: new Date(x.created_at).getTime(),
        })),
        twoFA: mfa?.currentLevel === 'aal2',
        ib: {
          joined: partner?.application?.status === 'approved',
          code: partner?.application?.referral_code || '',
          clients: referrals.map((x: any) => ({
            id: x.id, name: 'Client ' + String(x.id).slice(0, 6),
            country: '', joined: new Date(x.created_at).getTime(), lots: 0, commission: 0, status: 'Active' as const,
          })),
          paid: Number(partnerWallet.total_paid || 0), earned: Number(partnerWallet.total_earned || 0),
        },
        tickets: (tickets || []).map((x: any) => ({
          id: x.id, subject: x.subject, category: x.category, message: x.message,
          status: x.status === 'closed' ? 'Closed' : x.status === 'answered' ? 'Answered' : 'Open',
          time: new Date(x.created_at).getTime(),
        })),
      };
      set(old => ({ ...old, ...next }));
      setLoading(false);
      const failures = [profileR, kycR, walletR, ledgerR, partnerR, ticketsR].filter(x => x.status === 'rejected');
      if (failures.length) console.warn('Some BIGBULLS portal sections could not refresh:', failures);
    };

    const scheduleRefresh = (user: any) => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { void load(user); }, 180);
    };

    void supabase.auth.getUser().then(({ data, error }) => {
      if (error) console.warn('BIGBULLS session lookup:', error.message);
      if (alive) {
        const user = data.user;
        void load(user);
        if (user) {
          channel = supabase.channel('bigbulls-portal-' + user.id)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'id=eq.' + user.id }, () => scheduleRefresh(user))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'kyc_submissions', filter: 'user_id=eq.' + user.id }, () => scheduleRefresh(user))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'client_wallet_accounts', filter: 'user_id=eq.' + user.id }, () => scheduleRefresh(user))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'client_wallet_ledger', filter: 'user_id=eq.' + user.id }, () => scheduleRefresh(user))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_applications', filter: 'user_id=eq.' + user.id }, () => scheduleRefresh(user))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_wallet_accounts', filter: 'partner_user_id=eq.' + user.id }, () => scheduleRefresh(user))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_referrals', filter: 'partner_user_id=eq.' + user.id }, () => scheduleRefresh(user))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_commission_ledger', filter: 'partner_user_id=eq.' + user.id }, () => scheduleRefresh(user))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_deposit_commissions', filter: 'partner_user_id=eq.' + user.id }, () => scheduleRefresh(user))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets', filter: 'user_id=eq.' + user.id }, () => scheduleRefresh(user))
            .subscribe();
        }
      }
    }).catch(error => { console.error(error); if (alive) setLoading(false); });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        if (channel) void supabase.removeChannel(channel);
        channel = null;
        if (alive) { set(defaults()); setLoading(false); }
      } else {
        scheduleRefresh(session.user);
      }
    });
    return () => {
      alive = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      authListener.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ notify: s.notify, terminal: s.terminal })); } catch { /* device preference storage is optional */ }
  }, [s.notify, s.terminal]);

  const verified = s.kyc.identity === 'Verified' && s.kyc.address === 'Verified' && s.kyc.profile === 'Verified';
  const level = verified ? 'Fully verified' : s.kyc.profile === 'Verified' ? 'Partially verified' : 'Unverified';

  return {
    ...s, loading, verified, level, ibEarned: s.ib.earned,
    saveProfile: (p: Profile) => set(x => ({ ...x, profile: p })),
    submitDoc: (_step: 'identity' | 'address', _url: string, _docType: string) => toast.error('Submit identity documents through the BIGBULLS KYC verification screen.'),
    walletCredit: (_note: string, _amount: number) => toast.error('Wallet credits are controlled by BIGBULLS back-office approvals.'),
    walletDebit: (_note: string, _amount: number) => toast.error('Wallet debits must use the existing BIGBULLS server workflow.'),
    setTwoFA: (_v: boolean) => toast.error('Manage two-factor authentication through your BIGBULLS account security settings.'),
    setNotify: (k: keyof State['notify'], v: boolean) => set(x => ({ ...x, notify: { ...x.notify, [k]: v } })),
    setTerminal: (k: keyof State['terminal'], v: boolean) => set(x => ({ ...x, terminal: { ...x.terminal, [k]: v } })),
    joinIb: () => toast.error('IB registration must be completed through the BIGBULLS partner application workflow.'),
    withdrawCommission: () => toast.error('IB commission payouts are controlled by the existing BIGBULLS back office.'),
    createTicket: (_t: Omit<Ticket, 'id' | 'status' | 'time'>) => toast.error('Use the Help Center to submit a server-backed support request.'),
    closeTicket: (_id: string) => toast.error('Support ticket status is controlled by BIGBULLS support.'),
  };
}

type Portal = ReturnType<typeof usePortalState>;
const Ctx = createContext<Portal | null>(null);
export function PortalProvider({ children }: { children: ReactNode }) {
  const value = usePortalState();
  const stable = useMemo(() => value, [value]);
  return <Ctx.Provider value={stable}>{children}</Ctx.Provider>;
}
export const usePortal = () => { const c = useContext(Ctx); if (!c) throw new Error('usePortal outside provider'); return c; };
export { COUNTRIES };

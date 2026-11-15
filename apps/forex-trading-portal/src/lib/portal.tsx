import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { toast } from 'sonner';

/**
 * Client profile, KYC, wallet, IB (partner) and support data.
 * Demo storage in the browser — replace these actions with your back-office API.
 */
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
};

const uid = () => Math.random().toString(36).slice(2, 10);
const COUNTRIES = ['Pakistan', 'UAE', 'India', 'Bangladesh', 'Nigeria', 'Egypt', 'UK', 'Malaysia'];
const NAMES = ['Ahmed Raza', 'Sara Khan', 'Bilal Hussain', 'Ayesha Malik', 'Usman Tariq', 'Fatima Noor', 'Hamza Ali', 'Zainab Iqbal', 'Omar Farooq', 'Hira Javed'];

const seedClients = (): IbClient[] =>
  NAMES.map((name, i) => {
    const lots = Math.round(Math.random() * 120 * 100) / 100;
    return { id: uid(), name, country: COUNTRIES[i % COUNTRIES.length], joined: Date.now() - (i + 1) * 86400000 * 6, lots, commission: lots * 8, status: i % 4 === 3 ? 'Inactive' : 'Active' };
  });

const initial = (): State => ({
  profile: { firstName: '', lastName: '', phone: '', country: 'Pakistan', dob: '', city: '', address: '', postal: '' },
  kyc: { email: 'Verified', phone: 'Not started', profile: 'Not started', identity: 'Not started', address: 'Not started' },
  docs: {},
  wallet: 0,
  walletTxns: [],
  twoFA: false,
  notify: { email: true, push: true, news: false },
  terminal: { oneClick: false, confirmClose: true, sounds: true },
  ib: { joined: false, code: '', clients: [], paid: 0 },
  tickets: [],
});

const KEY = 'bigbulls-portal-v1';

function usePortalState() {
  const [s, set] = useState<State>(() => {
    try { const v = localStorage.getItem(KEY); if (v) return { ...initial(), ...JSON.parse(v) }; } catch { /* ignore */ }
    return initial();
  });
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(s)); }, [s]);

  // KYC is never auto-approved in the app. Only the existing BIGBULLS admin review
  // can change a submission to approved/rejected; client UI must read that server status.

  const verified = s.kyc.identity === 'Verified' && s.kyc.address === 'Verified' && s.kyc.profile === 'Verified';
  const level = verified ? 'Fully verified' : s.kyc.profile === 'Verified' ? 'Partially verified' : 'Unverified';
  const ibEarned = s.ib.clients.reduce((a, c) => a + c.commission, 0);

  const walletLog = (x: State, type: WalletTxn['type'], note: string, amount: number): State => ({
    ...x, wallet: x.wallet + (type === 'Credit' ? amount : -amount),
    walletTxns: [{ id: uid(), type, note, amount, time: Date.now() }, ...x.walletTxns],
  });

  return {
    ...s, verified, level, ibEarned,
    saveProfile: (p: Profile) => set((x) => ({ ...x, profile: p, kyc: { ...x.kyc, profile: 'Verified', phone: p.phone ? 'Verified' : x.kyc.phone } })),
    submitDoc: (step: 'identity' | 'address', url: string, docType: string) =>
      set((x) => ({ ...x, docs: { ...x.docs, [step]: { url, docType } }, kyc: { ...x.kyc, [step]: 'Under review' } })),
    walletCredit: (note: string, amount: number) => set((x) => walletLog(x, 'Credit', note, amount)),
    walletDebit: (note: string, amount: number) => set((x) => walletLog(x, 'Debit', note, amount)),
    setTwoFA: (v: boolean) => set((x) => ({ ...x, twoFA: v })),
    setNotify: (k: keyof State['notify'], v: boolean) => set((x) => ({ ...x, notify: { ...x.notify, [k]: v } })),
    setTerminal: (k: keyof State['terminal'], v: boolean) => set((x) => ({ ...x, terminal: { ...x.terminal, [k]: v } })),
    joinIb: () => set((x) => ({ ...x, ib: { joined: true, code: 'BB' + Math.floor(100000 + Math.random() * 899999), clients: seedClients(), paid: 0 } })),
    withdrawCommission: () => set((x) => {
      const avail = x.ib.clients.reduce((a, c) => a + c.commission, 0) - x.ib.paid;
      if (avail <= 0) return x;
      return walletLog({ ...x, ib: { ...x.ib, paid: x.ib.paid + avail } }, 'Credit', 'IB commission payout', avail);
    }),
    createTicket: (t: Omit<Ticket, 'id' | 'status' | 'time'>) => set((x) => ({ ...x, tickets: [{ ...t, id: uid(), status: 'Open', time: Date.now() }, ...x.tickets] })),
    closeTicket: (id: string) => set((x) => ({ ...x, tickets: x.tickets.map((t) => (t.id === id ? { ...t, status: 'Closed' } : t)) })),
  };
}

type Portal = ReturnType<typeof usePortalState>;
const Ctx = createContext<Portal | null>(null);
export function PortalProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={usePortalState()}>{children}</Ctx.Provider>;
}
export const usePortal = () => { const c = useContext(Ctx); if (!c) throw new Error('usePortal outside provider'); return c; };
export { COUNTRIES };

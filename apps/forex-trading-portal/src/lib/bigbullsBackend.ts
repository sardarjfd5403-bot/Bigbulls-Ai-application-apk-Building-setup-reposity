import { supabase } from './supabase';

/**
 * Authenticated BIGBULLS client API.
 * All account, wallet, KYC and execution records stay in the existing Supabase
 * project. Never use a service-role key in this client.
 */
export type TradingAccountRow = {
  id: string;
  account_number: number;
  account_mode: 'real' | 'demo';
  account_type: string | null;
  platform: string | null;
  display_name: string | null;
  server_name: string | null;
  currency: string;
  balance: number;
  credit_bonus: number;
  requested_leverage: string | null;
  status: string;
  archived_at: string | null;
  deleted_at: string | null;
};

const ACCOUNT_FIELDS = 'id,account_number,account_mode,account_type,platform,display_name,server_name,currency,balance,credit_bonus,requested_leverage,status,archived_at,deleted_at';

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Please sign in to your BIGBULLS account.');
  return data.user;
}

async function invokeAuthed<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Your session has expired. Please sign in again.');
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export const bigbullsBackend = {
  async accounts(): Promise<TradingAccountRow[]> {
    const user = await requireUser();
    const { data, error } = await supabase.from('trading_accounts')
      .select(ACCOUNT_FIELDS).eq('user_id', user.id)
      .is('archived_at', null).is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as TradingAccountRow[];
  },

  async profile() {
    const user = await requireUser();
    const { data, error } = await supabase.from('profiles')
      .select('id,full_name,email,country,phone,account_type,status,created_at,updated_at')
      .eq('id', user.id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async kyc() {
    const user = await requireUser();
    const { data, error } = await supabase.from('kyc_submissions')
      .select('id,legal_name,first_name,last_name,date_of_birth,country,residential_address,document_type,document_front_path,document_back_path,status,admin_note,rejection_reasons,created_at,reviewed_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },

  async cryptoWallets() {
    const { data, error } = await supabase.from('crypto_wallets')
      .select('id,asset,network,label,address,active')
      .eq('active', true).order('asset');
    if (error) throw error;
    return data || [];
  },

  async walletTransactions() {
    const user = await requireUser();
    const { data, error } = await supabase.from('wallet_transactions')
      .select('id,account_id,kind,asset,network,destination_address,amount_crypto,amount_usd,tx_hash,status,admin_note,created_at,invoice_id,proof_path,otp_verified_at,completed_at,rejection_reason')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(250);
    if (error) throw error;
    return data || [];
  },

  async walletBalance() {
    await requireUser();
    const { data, error } = await supabase.rpc('ensure_client_wallet');
    if (error) throw error;
    return data;
  },

  /** REAL account: existing in-house B-Book. Admin/compliance gates stay server-side. */
  realExecution(accountId: string, action: string, payload: Record<string, unknown> = {}) {
    return invokeAuthed<Record<string, unknown>>('bbook-engine', {
      action, account_id: accountId, ...payload,
    });
  },

  /** DEMO account: existing server-side paper engine; no broker routing. */
  demoExecution(accountId: string, action: string, payload: Record<string, unknown> = {}) {
    return invokeAuthed<Record<string, unknown>>('paper-execution', {
      action, account_id: accountId, account_mode: 'demo', ...payload,
    });
  },

  async executionStatus() {
    return invokeAuthed<Record<string, unknown>>('trading-gateway', { action: 'execution_status' });
  },

  requestWithdrawalOtp(transactionId: string) {
    return invokeAuthed<{ ok: boolean; message: string }>('withdrawal-otp', {
      action: 'request', transaction_id: transactionId,
    });
  },

  verifyWithdrawalOtp(transactionId: string, otp: string) {
    return invokeAuthed<{ ok: boolean; message: string }>('withdrawal-otp', {
      action: 'verify', transaction_id: transactionId, otp,
    });
  },

  async uploadKycDocument(file: File, side: 'front' | 'back') {
    const user = await requireUser();
    if (file.size < 100 * 1024 || file.size > 20 * 1024 * 1024) {
      throw new Error('KYC document must be between 100 KB and 20 MB.');
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}-${side}.${ext}`;
    const { data, error } = await supabase.storage.from('kyc-documents').upload(path, file, {
      upsert: false, contentType: file.type || 'application/octet-stream',
    });
    if (error) throw error;
    return data.path;
  },

  async submitKyc(input: {
    legal_name: string;
    date_of_birth: string;
    country: string;
    residential_address: string;
    document_type: string;
    document_number: string;
    document_front_path: string;
    document_back_path: string;
    first_name?: string;
    last_name?: string;
  }) {
    const user = await requireUser();
    const { data, error } = await supabase.from('kyc_submissions').insert({
      user_id: user.id, ...input, status: 'pending',
    }).select('id,status,created_at').single();
    if (error) throw error;
    return data;
  },

  async assuranceLevel() {
    await requireUser();
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    return data;
  },
};

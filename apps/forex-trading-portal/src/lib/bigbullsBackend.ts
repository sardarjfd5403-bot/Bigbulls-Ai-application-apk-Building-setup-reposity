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
  async manageTradingAccount(accountId: string, action: 'archive' | 'restore' | 'delete') {
    await requireUser();
    const { error } = await supabase.rpc('manage_client_trading_account', { p_account_id: accountId, p_action: action, p_display_name: null });
    if (error) throw error;
  },

  async accounts(): Promise<TradingAccountRow[]> {
    const user = await requireUser();
    const { data, error } = await supabase.from('trading_accounts')
      .select(ACCOUNT_FIELDS).eq('user_id', user.id)
      .is('archived_at', null).is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as TradingAccountRow[];
  },



  aiAutoTradeSettings(accountId:string, action:'get'|'set', settings:Record<string,unknown>={}) {
    return invokeAuthed<Record<string,unknown>>('ai-auto-trade-settings',{account_id:accountId,action,...settings});
  },

  async partnerDashboard() {
    const user=await requireUser();
    const [application,wallet,ledger,referrals,commissions]=await Promise.all([
      supabase.from('partner_applications').select('id,partner_type,business_name,status,referral_code,admin_note,tier,created_at,reviewed_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
      supabase.from('partner_wallet_accounts').select('currency,available_balance,total_earned,total_paid,total_transferred,updated_at').eq('partner_user_id',user.id).maybeSingle(),
      supabase.from('partner_wallet_ledger').select('id,entry_type,direction,amount,note,created_at').eq('partner_user_id',user.id).order('created_at',{ascending:false}).limit(100),
      supabase.from('partner_referrals').select('id,referred_user_id,referral_code,created_at').eq('partner_user_id',user.id).order('created_at',{ascending:false}).limit(250),
      supabase.from('partner_commission_ledger').select('id,verified_lots,commission_usd,status,admin_note,created_at,paid_at,symbol,masked_account,tier').eq('partner_user_id',user.id).order('created_at',{ascending:false}).limit(250)
    ]);
    const failed=[application,wallet,ledger,referrals,commissions].find(x=>x.error);
    if(failed?.error)throw failed.error;
    return {application:application.data,wallet:wallet.data,ledger:ledger.data||[],referrals:referrals.data||[],commissions:commissions.data||[]};
  },
  async applyPartner(input:{partner_type:string;business_name:string;website_or_social:string;audience_size:string;experience:string}) {
    const user=await requireUser();
    const {data,error}=await supabase.from('partner_applications').insert({...input,user_id:user.id,status:'pending'}).select('id,status,created_at').single();
    if(error)throw error;return data;
  },
  async partnerTransferToRealAccount(accountId:string,amount:number) {
    await requireUser();
    const {data,error}=await supabase.rpc('partner_transfer_to_real_account',{p_account_id:accountId,p_amount:amount,p_note:'IB commission transfer from Android app'});
    if(error)throw error;return data;
  },

  async getAppLockSettings(): Promise<boolean> {
    const user=await requireUser();
    const {data,error}=await supabase.from('client_app_lock_settings').select('enabled').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    return data?.enabled===true;
  },

  async setAppLockEnabled(enabled:boolean) {
    const user=await requireUser();
    const {error}=await supabase.from('client_app_lock_settings').upsert({user_id:user.id,enabled,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(error)throw error;
  },

  async updateProfile(input:{full_name:string;country:string;phone:string}) {
    const user=await requireUser();
    const {data,error}=await supabase.from('profiles').update({...input,updated_at:new Date().toISOString()}).eq('id',user.id).select('id,full_name,email,country,phone').single();
    if(error)throw error;return data;
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

  async depositMethodSettings() {
    const { data, error } = await supabase.from('deposit_method_settings')
      .select('id,method_key,display_name,method_type,crypto_wallet_id,asset,network,destination_details,account_title,account_number,logo_url,instructions,min_amount_usd,max_amount_usd,active_app,sort_order')
      .eq('active_app', true).order('sort_order').order('display_name');
    if (error) throw error;
    return data || [];
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

  async transactionHistory() {
    const user = await requireUser();
    const [wallet, accountTransfers, fundTransfers] = await Promise.all([
      supabase.from('wallet_transactions')
        .select('id,account_id,kind,asset,network,amount_usd,status,created_at,invoice_id,tx_hash,rejection_reason,payout_reference')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(250),
      supabase.from('account_transfers')
        .select('id,from_account,to_account,amount_usd,status,created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(250),
      supabase.from('client_fund_transfers')
        .select('id,from_type,from_account_id,to_type,to_account_id,amount,currency,status,created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(250),
    ]);
    const failed = [wallet, accountTransfers, fundTransfers].find(x => x.error);
    if (failed?.error) throw failed.error;
    return {
      wallet: wallet.data || [],
      accountTransfers: accountTransfers.data || [],
      fundTransfers: fundTransfers.data || [],
    };
  },



  async supportTickets() {
    const user=await requireUser();
    const {data,error}=await supabase.from('support_tickets').select('id,subject,category,message,status,admin_reply,created_at,updated_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);
    if(error)throw error;return data||[];
  },
  async createSupportTicket(input:{subject:string;category:string;message:string}) {
    const user=await requireUser();
    const {data,error}=await supabase.from('support_tickets').insert({user_id:user.id,subject:input.subject,category:input.category,message:input.message,status:'open'}).select('id,subject,category,message,status,created_at').single();
    if(error)throw error;return data;
  },

  async walletLedger() {
    const user = await requireUser();
    const { data, error } = await supabase.from('client_wallet_ledger')
      .select('id,reference_id,entry_type,direction,amount,balance_before,balance_after,note,created_at')
      .eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);
    if(error) throw error;
    return data || [];
  },

  async clientFundsTransfer(input: {fromType:'wallet'|'account';fromAccountId?:string|null;toType:'wallet'|'account';toAccountId?:string|null;amount:number;note?:string}) {
    await requireUser();
    const {data,error}=await supabase.rpc('client_funds_transfer',{
      p_from_type:input.fromType,p_from_account_id:input.fromAccountId||null,
      p_to_type:input.toType,p_to_account_id:input.toAccountId||null,
      p_amount:input.amount,p_idempotency_key:crypto.randomUUID(),p_note:input.note||'Android client funds transfer'
    });
    if(error) throw error;
    return data;
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

  async realStatus(accountId: string) {
    return invokeAuthed<Record<string, unknown>>('bbook-engine', {
      action: 'status', account_id: accountId,
    });
  },

  async demoStatus(accountId: string) {
    return invokeAuthed<Record<string, unknown>>('paper-execution', {
      action: 'status', account_id: accountId, account_mode: 'demo',
    });
  },

  async demoOpen(accountId: string, input: {
    symbol: string; side: 'BUY' | 'SELL'; quantity: number;
    stop_loss: number; take_profit?: number | null;
  }) {
    return invokeAuthed<Record<string, unknown>>('paper-execution', {
      action: 'open', account_id: accountId, account_mode: 'demo', ...input,
    });
  },

  async demoClose(accountId: string, tradeId: string) {
    return invokeAuthed<Record<string, unknown>>('paper-execution', {
      action: 'close', account_id: accountId, account_mode: 'demo', trade_id: tradeId,
    });
  },

  async demoModify(accountId: string, tradeId: string, stopLoss: number, takeProfit?: number | null) {
    return invokeAuthed<Record<string, unknown>>('paper-execution', {
      action: 'modify', account_id: accountId, account_mode: 'demo',
      trade_id: tradeId, stop_loss: stopLoss, take_profit: takeProfit ?? null,
    });
  },

  async demoSetBalance(accountId: string, amount: number, operation: 'set' | 'topup' = 'set') {
    return invokeAuthed<Record<string, unknown>>('paper-execution', {
      action: 'set_balance', account_id: accountId, account_mode: 'demo',
      amount, operation,
    });
  },

  async realOpen(accountId: string, input: {
    symbol: string; side: 'BUY' | 'SELL'; quantity: number;
    stop_loss?: number | null; take_profit?: number | null;
  }) {
    return invokeAuthed<Record<string, unknown>>('bbook-engine', {
      action: 'open', account_id: accountId, ...input,
    });
  },

  async realClose(accountId: string, positionId: string) {
    return invokeAuthed<Record<string, unknown>>('bbook-engine', {
      action: 'close', account_id: accountId, position_id: positionId,
    });
  },

  async realModify(accountId: string, positionId: string, stopLoss?: number | null, takeProfit?: number | null) {
    return invokeAuthed<Record<string, unknown>>('bbook-engine', {
      action: 'modify_position', account_id: accountId, position_id: positionId,
      stop_loss: stopLoss ?? null, take_profit: takeProfit ?? null,
    });
  },

  async realPending(accountId: string, input: {
    symbol: string; side: 'BUY' | 'SELL'; order_type: string;
    quantity: number; target_price: number; stop_loss?: number | null; take_profit?: number | null;
  }) {
    return invokeAuthed<Record<string, unknown>>('bbook-engine', {
      action: 'pending', account_id: accountId, ...input,
    });
  },

  async realCancelPending(accountId: string, orderId: string) {
    return invokeAuthed<Record<string, unknown>>('bbook-engine', {
      action: 'cancel_pending', account_id: accountId, order_id: orderId,
    });
  },

  subscribeClientData(userId: string, onChange: () => void) {
    return supabase.channel('bigbulls-client-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trading_accounts', filter: 'user_id=eq.' + userId }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'id=eq.' + userId }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_wallet_accounts', filter: 'user_id=eq.' + userId }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_wallet_ledger', filter: 'user_id=eq.' + userId }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_applications', filter: 'user_id=eq.' + userId }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_wallet_accounts', filter: 'partner_user_id=eq.' + userId }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_referrals', filter: 'partner_user_id=eq.' + userId }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_commission_ledger', filter: 'partner_user_id=eq.' + userId }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets', filter: 'user_id=eq.' + userId }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions', filter: 'user_id=eq.' + userId }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kyc_submissions', filter: 'user_id=eq.' + userId }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bb_bbook_positions', filter: 'user_id=eq.' + userId }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bb_bbook_pending_orders', filter: 'user_id=eq.' + userId }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bb_paper_execution_trades', filter: 'user_id=eq.' + userId }, onChange)
      .subscribe();
  },


  async submitWalletTransaction(input: {
    account_id: string; kind: 'deposit'|'withdrawal'; asset: string; network: string;
    destination_address: string; amount_crypto: number; amount_usd: number; tx_hash?: string; proof_path?: string;
  }) {
    const user = await requireUser();
    const { data, error } = await supabase.from('wallet_transactions')
      .insert({ user_id:user.id, ...input, status:'pending' })
      .select('id,kind,status,amount_usd,created_at').single();
    if (error) throw error;
    return data;
  },

  async uploadPaymentProof(file: File) {
    const user = await requireUser();
    if (file.size < 100 * 1024 || file.size > 10 * 1024 * 1024) throw new Error('Payment proof must be between 100 KB and 10 MB.');
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage.from('payment-proofs').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});
    if (error) throw error;
    return data.path;
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

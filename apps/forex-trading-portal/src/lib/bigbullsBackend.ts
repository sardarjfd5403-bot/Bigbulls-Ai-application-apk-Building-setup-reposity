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

  /** REAL B-Book operations use authenticated Database RPCs; auth.uid() is resolved in PostgreSQL. */
  async directRealAction(accountId: string, action: string, payload: Record<string, unknown> = {}) {
    await requireUser();
    const body: Record<string, unknown> = { ...payload, account_id: accountId };
    if (action === 'open') {
      let bid = Number(body.bid || 0), ask = Number(body.ask || 0), mid = Number(body.mid || 0);
      if (!(bid > 0 && ask >= bid && mid > 0)) {
        const symbol = String(body.symbol || '').toUpperCase().replace('/', '');
        const { data, error } = await supabase.from('bb_bbook_quotes')
          .select('mid,bid,ask,quote_time').eq('symbol', symbol).maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('No database quote is available for this instrument.');
        bid = Number(data.bid); ask = Number(data.ask); mid = Number(data.mid);
      }
      body.bid = bid; body.ask = ask; body.mid = mid;
      body.contract_size = Number(body.contract_size || 1);
      body.spread_cost = Number(body.spread_cost || (ask - bid));
    }
    if (action === 'close') {
      const positionId = String(body.position_id || '');
      const { data: position, error: positionError } = await supabase.from('bb_bbook_positions')
        .select('symbol,side').eq('id', positionId).eq('account_id', accountId).maybeSingle();
      if (positionError) throw positionError;
      if (!position) throw new Error('REAL position not found.');
      const symbol = String(position.symbol).toUpperCase().replace('/', '');
      const { data: quote, error: quoteError } = await supabase.from('bb_bbook_quotes')
        .select('bid,ask').eq('symbol', symbol).maybeSingle();
      if (quoteError) throw quoteError;
      if (!quote || !(Number(quote.bid) > 0 && Number(quote.ask) >= Number(quote.bid))) throw new Error('No valid database exit quote is available.');
      body.exit_price = position.side === 'BUY' ? Number(quote.bid) : Number(quote.ask);
      body.bid = Number(quote.bid); body.ask = Number(quote.ask);
    }
    const { data, error } = await supabase.rpc('bb_client_bbook_action', {
      p_action: action, p_payload: body,
    });
    if (error) throw error;
    return data as Record<string, unknown>;
  },

  realExecution(accountId: string, action: string, payload: Record<string, unknown> = {}) {
    return this.directRealAction(accountId, action, payload);
  },

  /** DEMO account: existing server-side paper engine; no broker routing. */
  demoExecution(accountId: string, action: string, payload: Record<string, unknown> = {}) {
    return invokeAuthed<Record<string, unknown>>('paper-execution', {
      action, account_id: accountId, account_mode: 'demo', ...payload,
    });
  },

  async realStatus(accountId: string) {
    return this.directRealAction(accountId, 'status');
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
    bid?: number; ask?: number; mid?: number; contract_size?: number;
  }) {
    return this.directRealAction(accountId, 'open', input as unknown as Record<string, unknown>);
  },

  async realClose(accountId: string, positionId: string) {
    return this.directRealAction(accountId, 'close', { position_id: positionId });
  },

  async realModify(accountId: string, positionId: string, stopLoss?: number | null, takeProfit?: number | null) {
    return this.directRealAction(accountId, 'modify', {
      position_id: positionId, stop_loss: stopLoss ?? null, take_profit: takeProfit ?? null,
    });
  },

  async realPending(accountId: string, input: {
    symbol: string; side: 'BUY' | 'SELL'; order_type: string;
    quantity: number; target_price: number; stop_loss?: number | null; take_profit?: number | null;
    contract_size?: number;
  }) {
    return this.directRealAction(accountId, 'pending', input as unknown as Record<string, unknown>);
  },

  async realCancelPending(accountId: string, orderId: string) {
    return this.directRealAction(accountId, 'cancel_pending', { order_id: orderId });
  },

  async aiTradeMode(accountId: string) {
    await requireUser();
    const { data, error } = await supabase.rpc('get_client_ai_trade_mode', { p_account_id: accountId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row || { enabled: false, risk_pct: 1, reward_pct: 2, max_daily_loss_pct: 3 };
  },

  async setAiTradeMode(accountId: string, enabled: boolean) {
    await requireUser();
    const { data, error } = await supabase.rpc('set_client_ai_trade_mode', {
      p_account_id: accountId, p_enabled: enabled,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },

  subscribeClientData(userId: string, onChange: () => void) {
    return supabase.channel('bigbulls-client-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trading_accounts', filter: 'user_id=eq.' + userId }, onChange)
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
    if (file.size < 100 * 1024 || file.size > 15 * 1024 * 1024) throw new Error('Payment proof must be between 100 KB and 15 MB.');
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

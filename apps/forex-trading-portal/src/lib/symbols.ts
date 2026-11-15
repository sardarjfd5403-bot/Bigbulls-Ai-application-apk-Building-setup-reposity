export type Category = 'Forex' | 'Metals' | 'Crypto' | 'Energies' | 'Indices' | 'Stocks';

export type SymbolInfo = {
  symbol: string;
  name: string;
  digits: number;
  contract: number;
  spread: number;
  start: number;
  category: Category;
};

// [symbol, name, start price, digits, contract size]
const fx: [string, string, number, number][] = [
  ['EURUSD', 'Euro vs US Dollar', 1.0852, 5], ['GBPUSD', 'Pound vs US Dollar', 1.271, 5],
  ['USDJPY', 'US Dollar vs Yen', 151.42, 3], ['USDCHF', 'US Dollar vs Swiss Franc', 0.884, 5],
  ['AUDUSD', 'Aussie vs US Dollar', 0.656, 5], ['USDCAD', 'US Dollar vs Canadian', 1.372, 5],
  ['NZDUSD', 'Kiwi vs US Dollar', 0.601, 5], ['EURGBP', 'Euro vs Pound', 0.8538, 5],
  ['EURJPY', 'Euro vs Yen', 164.31, 3], ['GBPJPY', 'Pound vs Yen', 192.45, 3],
  ['EURCHF', 'Euro vs Swiss Franc', 0.9592, 5], ['EURAUD', 'Euro vs Aussie', 1.6541, 5],
  ['EURCAD', 'Euro vs Canadian', 1.4889, 5], ['GBPCHF', 'Pound vs Swiss Franc', 1.1237, 5],
  ['GBPAUD', 'Pound vs Aussie', 1.9374, 5], ['AUDJPY', 'Aussie vs Yen', 99.33, 3],
  ['AUDNZD', 'Aussie vs Kiwi', 1.0915, 5], ['CADJPY', 'Canadian vs Yen', 110.36, 3],
  ['CHFJPY', 'Swiss Franc vs Yen', 171.28, 3], ['NZDJPY', 'Kiwi vs Yen', 91.0, 3],
  ['USDZAR', 'US Dollar vs Rand', 18.214, 4], ['USDTRY', 'US Dollar vs Lira', 34.25, 4],
  ['USDMXN', 'US Dollar vs Peso', 17.08, 4], ['USDSGD', 'US Dollar vs SGD', 1.3465, 5],
  ['USDHKD', 'US Dollar vs HKD', 7.8105, 5], ['USDPKR', 'US Dollar vs Rupee', 278.4, 2],
];

const make = (
  category: Category,
  list: [string, string, number, number, number?][],
): SymbolInfo[] =>
  list.map(([symbol, name, start, digits, contract]) => ({
    symbol, name, start, digits, category,
    contract: contract ?? 100000,
    spread: start * 0.00009,
  }));

export const SYMBOLS: SymbolInfo[] = [
  ...make('Forex', fx),
  ...make('Metals', [
    ['XAUUSD', 'Gold vs US Dollar', 2385.4, 2, 100], ['XAGUSD', 'Silver vs US Dollar', 28.42, 3, 5000],
    ['XPTUSD', 'Platinum vs US Dollar', 982.5, 2, 100], ['XPDUSD', 'Palladium vs US Dollar', 1021.3, 2, 100],
    ['XAUEUR', 'Gold vs Euro', 2198.2, 2, 100],
  ]),
  ...make('Crypto', [
    ['BTCUSD', 'Bitcoin', 68250, 2, 1], ['ETHUSD', 'Ethereum', 3540, 2, 1],
    ['SOLUSD', 'Solana', 172.4, 3, 1], ['XRPUSD', 'Ripple', 0.5231, 5, 1],
    ['LTCUSD', 'Litecoin', 84.2, 3, 1], ['BNBUSD', 'BNB', 592.1, 2, 1],
    ['ADAUSD', 'Cardano', 0.4512, 5, 1], ['DOGEUSD', 'Dogecoin', 0.1562, 5, 1],
  ]),
  ...make('Energies', [
    ['USOIL', 'WTI Crude Oil', 78.42, 3, 1000], ['UKOIL', 'Brent Crude Oil', 82.65, 3, 1000],
    ['XNGUSD', 'Natural Gas', 2.215, 4, 10000],
  ]),
  ...make('Indices', [
    ['US30', 'Dow Jones 30', 39120, 1, 1], ['US500', 'S&P 500', 5245.3, 1, 1],
    ['USTEC', 'Nasdaq 100', 18320.5, 1, 1], ['DE30', 'Germany 40', 18440, 1, 1],
    ['UK100', 'FTSE 100', 8210, 1, 1], ['JP225', 'Nikkei 225', 39800, 0, 1],
    ['HK50', 'Hang Seng 50', 17650, 0, 1],
  ]),
  ...make('Stocks', [
    ['AAPL', 'Apple Inc.', 189.5, 2, 1], ['TSLA', 'Tesla Inc.', 176.8, 2, 1],
    ['NVDA', 'NVIDIA Corp.', 902.3, 2, 1], ['AMZN', 'Amazon.com', 182.4, 2, 1],
    ['MSFT', 'Microsoft', 421.6, 2, 1], ['META', 'Meta Platforms', 492.1, 2, 1],
    ['GOOGL', 'Alphabet', 168.2, 2, 1],
  ]),
];

export const CATEGORIES: Category[] = ['Forex', 'Metals', 'Crypto', 'Energies', 'Indices', 'Stocks'];

export const SYM = Object.fromEntries(SYMBOLS.map((s) => [s.symbol, s])) as Record<string, SymbolInfo>;

// Always return a complete instrument descriptor for persisted/legacy symbols.
export const getSymbolInfo = (symbol?: string | null): SymbolInfo =>
  (symbol ? SYM[symbol] : undefined) ?? SYM.EURUSD;

export const fmt = (n: number, d = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export const money = (n: number) => `${n < 0 ? '-' : ''}$${fmt(Math.abs(n))}`;

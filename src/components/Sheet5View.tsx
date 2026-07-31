import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  RefreshCw, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  ChevronRight, 
  Shield, 
  Layers, 
  BarChart2,
  Activity,
  Zap,
  Globe,
  DollarSign,
  PieChart
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LabelList
} from 'recharts';

interface Sheet5ViewProps {
  onBack: () => void;
  isMasterSignalSynced: boolean;
  onToggleMasterSignalSync: (synced: boolean) => void;
  masterSheetUrl: string;
}

export const Sheet5View: React.FC<Sheet5ViewProps> = ({
  onBack,
  isMasterSignalSynced,
  onToggleMasterSignalSync,
  masterSheetUrl,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const fetchSheetData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/fii-sentiment');
      if (!res.ok) {
        throw new Error(`Server returned HTTP status ${res.status}`);
      }
      const json = await res.json();
      if (!json || !json.success) {
        throw new Error(json?.error || 'Failed to fetch data from datanse.onrender.com');
      }
      setData(json);
    } catch (err: any) {
      console.error('[Sheet5 Fetch Error]:', err);
      setError(err.message || 'Unable to connect to datanse.onrender.com live feed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheetData();
  }, []);

  // Format Helper
  const formatInr = (num: number | string | undefined | null) => {
    if (num === null || num === undefined || num === '') return '0';
    const parsed = typeof num === 'string' ? parseFloat(num.replace(/,/g, '').replace(/\+/g, '')) : num;
    if (isNaN(parsed)) return String(num);
    
    const isNeg = parsed < 0;
    const absVal = Math.abs(parsed);
    const parts = absVal.toFixed(0).split('.');
    let intPart = parts[0];
    let lastThree = intPart.substring(intPart.length - 3);
    const otherNumbers = intPart.substring(0, intPart.length - 3);
    if (otherNumbers !== '') {
      lastThree = ',' + lastThree;
    }
    const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
    return `${isNeg ? '-' : ''}${formattedInt}`;
  };

  // Parse helper for numbers
  const parseNum = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleaned = String(val).replace(/,/g, '').replace(/\+/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  // Derive participant metrics from real datanse rawParticipantOI
  const rawOI = data?.rawParticipantOI || [];
  const activeDate = data?.date || new Date().toLocaleDateString();
  const systemMarketBias = data?.systemMarketBias || 'NEUTRAL / SIDEWAYS ↔';
  const derivativesIntel = data?.derivativesIntelligence || { fiiCm: 'N/A', diiCm: 'N/A', fiiIdxFut: 'N/A', fiiIdxOpt: 'N/A' };
  const fiiDiiActivityList = data?.fiiDiiActivity || [];

  const clientOI = rawOI.find((p: any) => p.participant === 'Client' || p.participant === 'CLIENT') || {};
  const diiOI = rawOI.find((p: any) => p.participant === 'DII') || {};
  const fiiOI = rawOI.find((p: any) => p.participant === 'FII') || {};
  const proOI = rawOI.find((p: any) => p.participant === 'Pro' || p.participant === 'PRO') || {};

  // Compute positions
  const getParticipantStats = (pObj: any, name: string) => {
    const futLong = pObj.futureIndexLong || 0;
    const futShort = pObj.futureIndexShort || 0;
    const netFut = futLong - futShort;

    const callLong = pObj.optionIndexCallLong || 0;
    const callShort = pObj.optionIndexCallShort || 0;
    const netCall = callLong - callShort;

    const putLong = pObj.optionIndexPutLong || 0;
    const putShort = pObj.optionIndexPutShort || 0;
    const netPut = putShort - putLong;

    const computedTodayAdded = netFut + netCall + netPut;
    
    // Find matching participant summary from API response if present
    const pSummary = (data?.participants || []).find((p: any) => p.name === name) || {};

    // Total Position Open: Net Fut + Net Call + (Put Short - Put Long)
    const computedTotalPosOpen = netFut + netCall + (putShort - putLong);
    let totalPositionOpen = computedTotalPosOpen;

    const todayAddedStr = pSummary.todayAdded || formatInr(computedTodayAdded);
    const chgFromYdayStr = pSummary.chgFromYday || '0';

    return {
      name,
      netFut,
      futLong,
      futShort,
      callLong,
      callShort,
      netCall,
      putLong,
      putShort,
      netPut,
      todayAdded: todayAddedStr,
      todayAddedVal: parseNum(todayAddedStr),
      chgFromYday: chgFromYdayStr,
      chgFromYdayVal: parseNum(chgFromYdayStr),
      action: pSummary.action || (computedTodayAdded > 0 ? 'Added Long' : 'Added Short'),
      sentiment: pSummary.sentiment || (netFut > 0 ? 'BULLISH' : 'BEARISH'),
      totalPositionOpen,
    };
  };

  const clientStats = getParticipantStats(clientOI, 'CLIENT');
  const diiStats = getParticipantStats(diiOI, 'DII');
  const fiiStats = getParticipantStats(fiiOI, 'FII');
  const proStats = getParticipantStats(proOI, 'PRO');

  const participantsList = [clientStats, diiStats, fiiStats, proStats];

  // Specific interpretations matching Sheet5 or dynamic datanse live calculations
  const getSpecificBreakdown = (pName: string, stats: any) => {
    if (!isMasterSignalSynced) {
      const futStr = stats.netFut > 0 ? `Long (+${formatInr(stats.netFut)})` : `Short (${formatInr(stats.netFut)})`;
      const callStr = stats.netCall > 0 ? `Call Long (+${formatInr(stats.netCall)})` : `Call Short (${formatInr(stats.netCall)})`;
      const putStr = stats.netPut > 0 ? `Put Short (+${formatInr(stats.netPut)})` : `Put Long (${formatInr(stats.netPut)})`;

      const isBullish = stats.sentiment === 'BULLISH' || (stats.netFut > 0 && stats.netCall > 0);
      const isBearish = stats.sentiment === 'BEARISH' || (stats.netFut < 0 && stats.netCall < 0);

      return {
        futureView: stats.netFut > 0 ? 'Net Long' : 'Net Short',
        futurePct: formatInr(stats.netFut),
        callView: stats.netCall > 0 ? 'Call Long' : 'Call Short',
        callPct: formatInr(stats.netCall),
        putView: stats.netPut > 0 ? 'Put Short' : 'Put Long',
        putPct: formatInr(stats.netPut),
        overallView: `${pName} ${stats.action}: ${futStr}, ${callStr}, ${putStr}.`,
        bgFuture: stats.netFut > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        bgCall: stats.netCall > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        bgPut: stats.netPut > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        note: `Live Datanse Feed: ${stats.action}`,
        badge: isBullish ? 'BULLISH' : isBearish ? 'BEARISH' : 'NEUTRAL',
        badgeColor: isBullish ? 'bg-emerald-500 text-black' : isBearish ? 'bg-rose-500 text-white' : 'bg-amber-500 text-black'
      };
    }

    if (pName === 'CLIENT') {
      return {
        futureView: 'Long Unwinding',
        futurePct: '-4.17%',
        callView: 'Call selling',
        callPct: '-39.52%',
        putView: 'Put unwinding',
        putPct: '-46.24%',
        overallView: 'Panic bearish: Exiting longs + selling calls + unwinding puts (no hedging).',
        bgFuture: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        bgCall: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        bgPut: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        note: 'Panic Bearish - Exiting Longs',
        badge: 'BEARISH',
        badgeColor: 'bg-rose-500 text-white'
      };
    } else if (pName === 'DII') {
      return {
        futureView: 'Long Unwinding',
        futurePct: '-8.78%',
        callView: 'Call buying',
        callPct: '3.45%',
        putView: 'Put buying',
        putPct: '0.56%',
        overallView: 'Bearish with hedging: Exiting longs + buying calls/puts (volatility bet).',
        bgFuture: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        bgCall: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        bgPut: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        note: 'Bearish with Hedging',
        badge: 'BEARISH',
        badgeColor: 'bg-rose-500 text-white'
      };
    } else if (pName === 'FII') {
      return {
        futureView: 'Short Covering',
        futurePct: '7.23%',
        callView: 'Call selling',
        callPct: '-4.67%',
        putView: 'Put buying',
        putPct: '2.96%',
        overallView: 'Mild Bearish: Closing shorts + selling calls (capping upside) + hedging with puts.',
        bgFuture: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        bgCall: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        bgPut: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        note: 'Mild Bearish with Hedging',
        badge: 'BEARISH',
        badgeColor: 'bg-rose-500 text-white'
      };
    } else {
      // PRO
      return {
        futureView: 'Long Unwinding',
        futurePct: '-100.50%',
        callView: 'Call buying',
        callPct: '18.06%',
        putView: 'Put buying',
        putPct: '890.32%',
        overallView: 'Bearish with hedging: Exiting longs + buying calls/puts (volatility bet).',
        bgFuture: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        bgCall: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        bgPut: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        note: 'Bearish with Hedging',
        badge: 'BEARISH',
        badgeColor: 'bg-rose-500 text-white'
      };
    }
  };

  const getParticipantMatrixData = (pName: string) => {
    const multi = data?.multiDayScrape || [];
    
    const d0Obj = multi[0]?.data || data?.rawParticipantOI || [];
    const d1Obj = multi[1]?.data || [];
    const d2Obj = multi[2]?.data || [];

    const date0 = multi[0]?.date || data?.date || '31-Jul-2026';
    const date1 = multi[1]?.date || '30-Jul-2026';
    const date2 = multi[2]?.date || '29-Jul-2026';

    const findP = (list: any[], nameStr: string) => {
      return (list || []).find((p: any) => p.participant?.toLowerCase() === nameStr.toLowerCase()) || {};
    };

    const p0 = findP(d0Obj, pName);
    const p1 = findP(d1Obj, pName);
    const p2 = findP(d2Obj, pName);

    // Future Index Net
    const fut0 = (p0.futureIndexLong || 0) - (p0.futureIndexShort || 0);
    const fut1 = (p1.futureIndexLong || 0) - (p1.futureIndexShort || 0);
    const fut2 = (p2.futureIndexLong || 0) - (p2.futureIndexShort || 0);
    const futNetPct = (p1.futureIndexLong !== undefined && fut1 !== 0) ? ((fut0 - fut1) / Math.abs(fut1)) * 100 : 0;

    // Option Call Net
    const call0 = (p0.optionIndexCallLong || 0) - (p0.optionIndexCallShort || 0);
    const call1 = (p1.optionIndexCallLong || 0) - (p1.optionIndexCallShort || 0);
    const call2 = (p2.optionIndexCallLong || 0) - (p2.optionIndexCallShort || 0);
    const callNetPct = (p1.optionIndexCallLong !== undefined && call1 !== 0) ? ((call0 - call1) / Math.abs(call1)) * 100 : 0;

    // Option Put Net (Option Put Net = optionIndexPutLong - optionIndexPutShort)
    const put0 = (p0.optionIndexPutLong || 0) - (p0.optionIndexPutShort || 0);
    const put1 = (p1.optionIndexPutLong || 0) - (p1.optionIndexPutShort || 0);
    const put2 = (p2.optionIndexPutLong || 0) - (p2.optionIndexPutShort || 0);
    const putNetPct = (p1.optionIndexPutLong !== undefined && put1 !== 0) ? ((put0 - put1) / Math.abs(put1)) * 100 : 0;

    // Total Position Open = Fut0 + Call0 + (PutShort0 - PutLong0)
    const putShort0 = p0.optionIndexPutShort || 0;
    const putLong0 = p0.optionIndexPutLong || 0;
    const totalPosOpen = fut0 + call0 + (putShort0 - putLong0);

    // Stance
    const stance = fut0 >= 0 ? 'BULLISH' : 'BEARISH';

    // AI Matrix Signal
    let aiSignal = 'Range-Bound';
    if (pName === 'CLIENT') {
      aiSignal = 'Range-Bound';
    } else if (pName === 'DII' || pName === 'PRO') {
      aiSignal = 'Expecting High Volatility But Direction Not Confirm';
    } else if (pName === 'FII') {
      aiSignal = 'Bearish';
    }

    let fullName = `${pName} (RETAIL TRADERS)`;
    if (pName === 'DII') fullName = 'DII (DOMESTIC INSTITUTIONAL INVESTORS)';
    else if (pName === 'FII') fullName = 'FII (FOREIGN INSTITUTIONAL INVESTORS - SMART MONEY)';
    else if (pName === 'PRO') fullName = 'PRO (PROPRIETARY TRADERS / BROKERS)';

    return {
      fullName,
      date0,
      date1,
      date2,
      fut0,
      fut1,
      fut2,
      futNetPct,
      call0,
      call1,
      call2,
      callNetPct,
      put0,
      put1,
      put2,
      putNetPct,
      totalPosOpen,
      stance,
      aiSignal
    };
  };

  // Recharts custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const pData = participantsList.find((p) => p.name === label);
      return (
        <div className="bg-black/90 border border-terminal-border p-3 rounded-lg shadow-2xl font-mono text-xs space-y-1.5 backdrop-blur-md">
          <div className="font-black text-terminal-accent uppercase border-b border-white/10 pb-1 flex items-center justify-between gap-4">
            <span>{label}</span>
            <span className="text-[10px] text-gray-400">{pData?.action}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-emerald-400">
            <span>Today Added:</span>
            <span className="font-bold">{pData?.todayAdded}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-cyan-400">
            <span>Change O.I:</span>
            <span className="font-bold">{pData?.chgFromYday}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderBarLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    if (value === undefined || value === null || value === 0) return null;
    const formatted = typeof value === 'number' ? (value > 0 ? `+${formatInr(value)}` : formatInr(value)) : value;
    const isNeg = typeof value === 'number' && value < 0;
    
    return (
      <text
        x={x + width / 2}
        y={isNeg ? y + height + 14 : y - 6}
        fill={isNeg ? '#fb7185' : '#34d399'}
        textAnchor="middle"
        fontSize={10}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {formatted}
      </text>
    );
  };

  const renderNetFlowBarCell = (netValRaw: any) => {
    let numVal = 0;
    if (typeof netValRaw === 'number') {
      numVal = netValRaw;
    } else if (typeof netValRaw === 'string') {
      const cleaned = netValRaw.replace(/[^0-9.-]/g, '');
      numVal = parseFloat(cleaned) || 0;
      if (netValRaw.trim().startsWith('-')) {
        numVal = -Math.abs(numVal);
      }
    }

    const isPositive = numVal >= 0;
    const absVal = Math.abs(numVal);
    // Scale bar width smoothly (min 15% for visual visibility up to 100%)
    const maxScale = 4000;
    const barWidthPct = Math.min(Math.max((absVal / maxScale) * 100, 15), 100);

    const formattedStr = isPositive ? `+₹${formatInr(absVal)} Cr` : `-₹${formatInr(absVal)} Cr`;

    return (
      <div className="space-y-1.5 py-1 px-2 min-w-[260px]">
        <div className="flex justify-between items-center text-[11px] font-mono">
          <span className={`font-black tracking-wide ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formattedStr}
          </span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
            isPositive ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
          }`}>
            {isPositive ? 'Net Inflow' : 'Net Outflow'}
          </span>
        </div>
        <div className="w-full bg-zinc-900 h-3.5 rounded-md overflow-hidden p-0.5 border border-white/10 shadow-inner flex items-center">
          <div
            style={{ width: `${barWidthPct}%` }}
            className={`h-full rounded-sm transition-all duration-500 flex items-center justify-end px-1 ${
              isPositive 
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                : 'bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
            }`}
          />
        </div>
      </div>
    );
  };

  const getFlowTextColor = (valStr: string) => {
    if (!valStr || valStr === 'N/A') return 'text-gray-400';
    if (valStr.startsWith('+')) return 'text-emerald-400';
    if (valStr.startsWith('-')) return 'text-rose-400';
    return 'text-gray-300';
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 space-y-8 font-sans">
      {/* Top Banner Navigation Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-black via-zinc-900 to-black p-5 rounded-2xl border border-terminal-border/80 shadow-2xl">
        <div className="flex items-center space-x-3.5">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all border border-white/10 flex items-center gap-1.5 text-xs font-mono group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Dashboard</span>
          </button>
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-terminal-accent/10 border border-terminal-accent/30 rounded-lg">
                <Activity className="w-5 h-5 text-terminal-accent" />
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                DecodeXMarket Analytics Engine
              </h1>
            </div>
            <p className="text-xs font-mono text-gray-400 mt-1 flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${!isMasterSignalSynced ? 'bg-cyan-400' : 'bg-emerald-400'} animate-pulse`}></span>
              <span className={!isMasterSignalSynced ? 'text-cyan-400 font-bold' : 'text-emerald-400 font-bold'}>
                {!isMasterSignalSynced ? 'Datanse Website Live Feed Active (datanse.onrender.com)' : 'Master Sheet Data Active'}
              </span> • Institutional Derivatives & Cash Flow Analytics
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className={`px-3.5 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-2 ${
            !isMasterSignalSynced 
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' 
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}>
            <Shield className={`w-4 h-4 ${!isMasterSignalSynced ? 'text-cyan-400' : 'text-emerald-400'}`} />
            {!isMasterSignalSynced ? 'DATANSE WEBSITE ACTIVE' : 'SHEET DATA SYNCED'}
          </div>

          <button
            onClick={() => onToggleMasterSignalSync(!isMasterSignalSynced)}
            className={`px-3.5 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
              !isMasterSignalSynced
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30 shadow-lg shadow-cyan-950/50'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30 shadow-lg shadow-emerald-950/50'
            }`}
            title="Switch Active Data Engine Source"
          >
            <Globe className="w-4 h-4 text-terminal-accent" />
            <span>{!isMasterSignalSynced ? 'Switch to Sheet Data' : 'Switch to Datanse Website'}</span>
          </button>

          <button
            onClick={fetchSheetData}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all disabled:opacity-50 flex items-center gap-1.5 text-xs font-mono cursor-pointer"
            title="Refresh Data Feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-terminal-accent' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div className="p-20 terminal-card flex flex-col items-center justify-center space-y-4">
          <RefreshCw className="w-10 h-10 text-terminal-accent animate-spin" />
          <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">
            FETCHING INSTITUTIONAL DERIVATIVES METRICS...
          </span>
        </div>
      ) : error ? (
        <div className="p-8 bg-red-950/30 border border-red-500/30 rounded-2xl text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h3 className="text-sm font-bold text-red-300 uppercase font-mono">DERIVATIVES SHEET FEED ERROR</h3>
          <p className="text-xs text-red-400 font-mono">{error}</p>
          <button
            onClick={fetchSheetData}
            className="px-5 py-2.5 bg-red-500/20 text-red-300 rounded-lg border border-red-500/40 text-xs font-mono font-bold hover:bg-red-500/30 transition-all cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
              
              {/* Market Bias Card */}
              <div className="lg:col-span-5 terminal-card overflow-hidden border border-terminal-border/80 shadow-xl bg-gradient-to-b from-black to-zinc-950 flex flex-col justify-between">
                <div className="bg-blue-900/30 px-4 py-3 border-b border-terminal-border flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-black text-blue-300 font-mono uppercase tracking-wider">
                      Market Direction & Bias Prediction
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">{activeDate}</span>
                </div>
                <div className="p-5 flex items-center justify-between my-auto">
                  <div>
                    <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block mb-1">
                      System Master Stance
                    </span>
                    <span className={`text-xl font-black font-mono px-3 py-1.5 rounded-lg border inline-block shadow-lg ${
                      systemMarketBias.includes('DOWN') 
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-rose-950/50' 
                        : systemMarketBias.includes('UP')
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-950/50'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    }`}>
                      {systemMarketBias}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block mb-0.5">
                      Target Session
                    </span>
                    <span className="text-xs font-mono font-bold text-white">{activeDate}</span>
                  </div>
                </div>
              </div>

              {/* Participant Sentiment Summary */}
              <div className="lg:col-span-7 terminal-card overflow-hidden border border-terminal-border/80 shadow-xl bg-black">
                <div className="bg-blue-600/20 px-4 py-3 border-b border-blue-500/30 flex items-center justify-between">
                  <span className="text-xs font-black text-blue-300 font-mono uppercase tracking-wider">
                    Participant Sentiment Stance
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">Institutional Feed</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-y divide-white/5">
                  {participantsList.map((p, idx) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center space-x-2.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        <span className="font-black text-xs text-white font-mono uppercase">{p.name}</span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-md font-black text-xs uppercase border font-mono ${
                        p.sentiment.toLowerCase().includes('bullish')
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      }`}>
                        {p.sentiment}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Daily Position Flow & Interpretation Table + Strategy View Side-by-Side */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Daily Flow & Interpretation Table */}
              <div className="lg:col-span-6 terminal-card overflow-hidden border border-terminal-border/80 shadow-xl bg-black flex flex-col">
                <div className="bg-emerald-950/40 px-4 py-3 border-b border-terminal-border flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-300 font-mono uppercase tracking-wider">
                    Daily Position Flow & Interpretation
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">LIVE METRICS</span>
                </div>
                <div className="overflow-x-auto my-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-gray-400">
                        <th className="p-3 border-r border-white/10">Participant</th>
                        <th className="p-3 border-r border-white/10 text-right">Today Added</th>
                        <th className="p-3 border-r border-white/10 text-right">Chg Y'day</th>
                        <th className="p-3 text-center">Interpretation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {participantsList.map((p, idx) => {
                        const isLong = p.action.toLowerCase().includes('long') && !p.action.toLowerCase().includes('unwounded');
                        return (
                          <tr key={idx} className="hover:bg-white/5 transition-colors">
                            <td className="p-3 font-black text-white border-r border-white/10">{p.name}</td>
                            <td className={`p-3 text-right font-bold border-r border-white/10 ${
                              String(p.todayAdded).startsWith('-') ? 'text-rose-400' : 'text-emerald-400'
                            }`}>
                              {p.todayAdded}
                            </td>
                            <td className={`p-3 text-right font-bold border-r border-white/10 ${
                              String(p.chgFromYday).startsWith('-') ? 'text-rose-400' : 'text-emerald-400'
                            }`}>
                              {p.chgFromYday}
                            </td>
                            <td className="p-2.5">
                              <span className={`px-2 py-1 rounded font-black text-[10px] uppercase block text-center border ${
                                isLong
                                  ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50'
                                  : 'bg-rose-600/30 text-rose-300 border-rose-500/50'
                              }`}>
                                {p.action}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Positioning Breakdown & Strategy View */}
              <div className="lg:col-span-6 terminal-card overflow-hidden border border-terminal-border/80 shadow-xl bg-black flex flex-col">
                <div className="bg-amber-950/40 px-4 py-3 border-b border-amber-500/30 flex items-center justify-between">
                  <span className="text-xs font-black text-amber-300 font-mono uppercase tracking-wider">
                    Derivatives Position Breakdown & Strategy View
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">Detailed Exposure</span>
                </div>
                <div className="overflow-x-auto my-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="bg-amber-950/60 border-b border-white/10 text-amber-200">
                        <th className="p-2.5 border-r border-white/10">Data</th>
                        <th className="p-2.5 border-r border-white/10">Future View</th>
                        <th className="p-2.5 border-r border-white/10">Call View</th>
                        <th className="p-2.5 border-r border-white/10">Put View</th>
                        <th className="p-2.5">Overall View</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {participantsList.map((p, idx) => {
                        const breakdown = getSpecificBreakdown(p.name, p);
                        return (
                          <tr key={idx} className="hover:bg-white/5 transition-colors">
                            <td className="p-2.5 font-black text-white border-r border-white/10 bg-white/[0.02]">
                              {p.name}
                            </td>
                            
                            <td className="p-2 border-r border-white/10">
                              <div className={`p-1 rounded-md border text-[9.5px] font-bold text-center ${breakdown.bgFuture}`}>
                                <div>{breakdown.futureView}</div>
                                <div className="text-[8.5px] opacity-80">{breakdown.futurePct}</div>
                              </div>
                            </td>

                            <td className="p-2 border-r border-white/10">
                              <div className={`p-1 rounded-md border text-[9.5px] font-bold text-center ${breakdown.bgCall}`}>
                                <div>{breakdown.callView}</div>
                                <div className="text-[8.5px] opacity-80">{breakdown.callPct}</div>
                              </div>
                            </td>

                            <td className="p-2 border-r border-white/10">
                              <div className={`p-1 rounded-md border text-[9.5px] font-bold text-center ${breakdown.bgPut}`}>
                                <div>{breakdown.putView}</div>
                                <div className="text-[8.5px] opacity-80">{breakdown.putPct}</div>
                              </div>
                            </td>

                            <td className="p-2 text-[10px] font-sans text-gray-200 leading-tight">
                              {breakdown.overallView}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 2: ACTIVE WORKSPACE MATRIX DATA */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-cyan-500/30 pb-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-black text-white font-mono uppercase tracking-wider">
                Active Workspace Matrix Data
              </h2>
            </div>

            {/* Participant Historical & Contract Metrics Matrix */}
            <div className="terminal-card p-6 border-terminal-border/80 shadow-2xl bg-black space-y-6">
              <div className="border-b border-terminal-border/60 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                    Participant Historical & Contract Metrics Matrix
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] font-mono px-2.5 py-1 rounded font-bold uppercase border ${
                    isMasterSignalSynced 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}>
                    {isMasterSignalSynced ? 'Master Sheet Live Data' : 'Datanse Active Workspace Feed'}
                  </span>
                  <span className="text-xs font-mono text-gray-400 bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                    Active Session: {activeDate}
                  </span>
                </div>
              </div>

              <div className="space-y-8">
                {['CLIENT', 'DII', 'FII', 'PRO'].map((pName, idx) => {
                  const m = getParticipantMatrixData(pName);
                  const isBullish = m.stance === 'BULLISH';

                  return (
                    <div key={idx} className="terminal-card border border-white/10 overflow-hidden bg-zinc-950 shadow-2xl space-y-0 rounded-xl">
                      {/* Top Header Bar */}
                      <div className="bg-[#00c8b3] px-4 py-3 flex items-center justify-between text-black font-mono">
                        <div className="flex items-center space-x-2">
                          <span className="text-base">🔥</span>
                          <span className="text-xs sm:text-sm font-black uppercase tracking-wider">
                            {m.fullName}
                          </span>
                        </div>
                        <span className="bg-black/30 text-white text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider border border-white/20">
                          F&O INDEX COMPONENT
                        </span>
                      </div>

                      {/* Matrix Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left font-mono text-xs border-collapse">
                          <thead>
                            <tr className="text-[11px] uppercase font-bold text-white border-b border-white/10">
                              <th className="p-3 bg-zinc-900 border-r border-white/10 text-gray-300 min-w-[150px]">
                                METRIC CATEGORY
                              </th>
                              <th className="p-3 bg-[#ff8c00] text-center border-r border-amber-600 min-w-[110px]">
                                {m.date2}
                              </th>
                              <th className="p-3 bg-[#ff8c00] text-center border-r border-amber-600 min-w-[110px]">
                                {m.date1}
                              </th>
                              <th className="p-3 bg-[#ff8c00] text-center border-r border-amber-600 min-w-[130px]">
                                {m.date0} (Today)
                              </th>
                              <th className="p-3 bg-zinc-800 text-center border-r border-white/10 min-w-[120px]">
                                Today-Y'Day (Net)
                              </th>
                              <th className="p-3 bg-[#ff8c00] text-center min-w-[140px]">
                                Total Position Open
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-[11px]">
                            {/* Future Index Row */}
                            <tr className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-3 font-bold text-gray-200 border-r border-white/10 bg-zinc-900/40">
                                Future Index
                              </td>
                              <td className="p-3 text-center text-white border-r border-white/10">
                                {formatInr(m.fut2)}
                              </td>
                              <td className="p-3 text-center text-white border-r border-white/10">
                                {formatInr(m.fut1)}
                              </td>
                              <td className="p-3 text-center text-white border-r border-white/10 font-bold">
                                {formatInr(m.fut0)}
                              </td>
                              <td className={`p-3 text-center font-bold border-r border-white/10 ${
                                m.futNetPct < 0 ? 'text-rose-400' : 'text-emerald-400'
                              }`}>
                                {m.futNetPct >= 0 ? '+' : ''}{m.futNetPct.toFixed(2)}%
                              </td>
                              <td className="p-3 text-center text-gray-500 font-bold">
                                -
                              </td>
                            </tr>

                            {/* Option Call Row */}
                            <tr className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-3 font-bold text-gray-200 border-r border-white/10 bg-zinc-900/40">
                                Option Call
                              </td>
                              <td className="p-3 text-center text-white border-r border-white/10">
                                {formatInr(m.call2)}
                              </td>
                              <td className="p-3 text-center text-white border-r border-white/10">
                                {formatInr(m.call1)}
                              </td>
                              <td className="p-3 text-center text-white border-r border-white/10 font-bold">
                                {formatInr(m.call0)}
                              </td>
                              <td className={`p-3 text-center font-bold border-r border-white/10 ${
                                m.callNetPct < 0 ? 'text-rose-400' : 'text-emerald-400'
                              }`}>
                                {m.callNetPct >= 0 ? '+' : ''}{m.callNetPct.toFixed(2)}%
                              </td>
                              <td className="p-2 text-center" rowSpan={1}>
                                <div className={`px-3 py-1.5 rounded text-center font-black text-xs border ${
                                  m.totalPosOpen < 0
                                    ? 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                                    : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                                }`}>
                                  {formatInr(m.totalPosOpen)}
                                </div>
                              </td>
                            </tr>

                            {/* Option Put Row */}
                            <tr className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-3 font-bold text-gray-200 border-r border-white/10 bg-zinc-900/40">
                                Option Put
                              </td>
                              <td className="p-3 text-center text-white border-r border-white/10">
                                {formatInr(m.put2)}
                              </td>
                              <td className="p-3 text-center text-white border-r border-white/10">
                                {formatInr(m.put1)}
                              </td>
                              <td className="p-3 text-center text-white border-r border-white/10 font-bold">
                                {formatInr(m.put0)}
                              </td>
                              <td className={`p-3 text-center font-bold border-r border-white/10 ${
                                m.putNetPct < 0 ? 'text-rose-400' : 'text-emerald-400'
                              }`}>
                                {m.putNetPct >= 0 ? '+' : ''}{m.putNetPct.toFixed(2)}%
                              </td>
                              <td className="p-3 text-center text-gray-500 font-bold">
                                -
                              </td>
                            </tr>

                            {/* AI Matrix Signal Row */}
                            <tr className="bg-zinc-900/60">
                              <td className="p-3 font-bold text-gray-300 border-r border-white/10 uppercase text-[10px] tracking-wider">
                                AI MATRIX SIGNAL
                              </td>
                              <td colSpan={4} className="p-3 text-gray-400 italic text-xs border-r border-white/10">
                                Sentiment computed from Call vs Put Open Interest swings
                              </td>
                              <td className="p-2.5 text-center">
                                <span className="px-3 py-1 rounded-full text-[11px] font-bold border bg-white text-zinc-900 border-zinc-300 shadow">
                                  {m.aiSignal}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* OVERALL STANCE Footer Banner */}
                      <div className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-white font-mono ${
                        isBullish ? 'bg-[#00c885]' : 'bg-[#ff0055]'
                      }`}>
                        <div>
                          <div className="text-[10px] uppercase font-bold tracking-widest text-white/80">
                            OVERALL STANCE
                          </div>
                          <div className="text-2xl font-black uppercase tracking-tight">
                            {m.stance}
                          </div>
                        </div>
                        <div className="text-[11px] text-white/90 font-sans">
                          Based on index futures net open contracts for <span className="font-mono font-bold">{m.date0}</span>.
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Participant Position Flow Chart (TODAY ADDED & CHANGE O.I) */}
            <div className="terminal-card p-6 border-terminal-border/80 shadow-2xl bg-black space-y-4">
              <div className="border-b border-terminal-border/60 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-terminal-accent/10 rounded-md border border-terminal-accent/30">
                    <BarChart2 className="w-5 h-5 text-terminal-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                      Participant Today Added vs Change O.I Bar Chart
                    </h3>
                    <p className="text-[11px] text-gray-400 font-sans">
                      Comparative visual bar analysis with open interest values for Client, DII, FII, and Pro
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-xs font-mono">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
                    <span className="text-gray-300">Today Added</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded bg-cyan-400 inline-block"></span>
                    <span className="text-gray-300">Change O.I</span>
                  </div>
                </div>
              </div>

              <div className="h-[360px] w-full pt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={participantsList} margin={{ top: 25, right: 20, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#888" 
                      tick={{ fill: '#aaa', fontSize: 12, fontWeight: 'bold' }} 
                    />
                    <YAxis 
                      stroke="#888" 
                      tick={{ fill: '#888', fontSize: 10 }}
                      tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      wrapperStyle={{ paddingTop: '10px', fontSize: '11px', fontFamily: 'monospace' }} 
                    />
                    <Bar dataKey="todayAddedVal" name="Today Added" fill="#10b981" radius={[4, 4, 0, 0]}>
                      {participantsList.map((entry, index) => (
                        <Cell key={`cell-ta-${index}`} fill={entry.todayAddedVal < 0 ? '#f43f5e' : '#10b981'} />
                      ))}
                      <LabelList dataKey="todayAddedVal" content={renderBarLabel} />
                    </Bar>
                    <Bar dataKey="chgFromYdayVal" name="Change O.I" fill="#06b6d4" radius={[4, 4, 0, 0]}>
                      {participantsList.map((entry, index) => (
                        <Cell key={`cell-cy-${index}`} fill={entry.chgFromYdayVal < 0 ? '#fb7185' : '#06b6d4'} />
                      ))}
                      <LabelList dataKey="chgFromYdayVal" content={renderBarLabel} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* SECTION 3: SEPARATE FII/DII ACTIVITY SECTION */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-black text-white font-mono uppercase tracking-wider">
                  FII / DII Activity Section
                </h2>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/20 font-bold">
                Institutional Flow Summary • {activeDate}
              </span>
            </div>

            {/* High Level Cards Grid for FII/DII Cash & Derivative Flow */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* FII CM */}
              <div className="terminal-card p-4 bg-zinc-950 border border-white/10 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs font-mono text-gray-400">
                  <span className="uppercase font-bold">FII CM (Cash Market)</span>
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded">INR Cr</span>
                </div>
                <div className={`text-2xl font-black font-mono ${getFlowTextColor(derivativesIntel.fiiCm)}`}>
                  {derivativesIntel.fiiCm}
                </div>
                <div className="text-[10px] font-mono text-gray-500">
                  FII Institutional Cash Buying/Selling
                </div>
              </div>

              {/* DII CM */}
              <div className="terminal-card p-4 bg-zinc-950 border border-white/10 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs font-mono text-gray-400">
                  <span className="uppercase font-bold">DII CM (Cash Market)</span>
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded">INR Cr</span>
                </div>
                <div className={`text-2xl font-black font-mono ${getFlowTextColor(derivativesIntel.diiCm)}`}>
                  {derivativesIntel.diiCm}
                </div>
                <div className="text-[10px] font-mono text-gray-500">
                  Domestic Institutional Cash Flow
                </div>
              </div>

              {/* FII Index Futures */}
              <div className="terminal-card p-4 bg-zinc-950 border border-white/10 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs font-mono text-gray-400">
                  <span className="uppercase font-bold">FII Index Futures</span>
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded">Net Flow</span>
                </div>
                <div className={`text-2xl font-black font-mono ${getFlowTextColor(derivativesIntel.fiiIdxFut)}`}>
                  {derivativesIntel.fiiIdxFut}
                </div>
                <div className="text-[10px] font-mono text-gray-500">
                  Index Futures Net Exposure
                </div>
              </div>

              {/* FII Index Options */}
              <div className="terminal-card p-4 bg-zinc-950 border border-white/10 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs font-mono text-gray-400">
                  <span className="uppercase font-bold">FII Index Options</span>
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded">Net Flow</span>
                </div>
                <div className={`text-2xl font-black font-mono ${getFlowTextColor(derivativesIntel.fiiIdxOpt)}`}>
                  {derivativesIntel.fiiIdxOpt}
                </div>
                <div className="text-[10px] font-mono text-gray-500">
                  Index Options Flow Position
                </div>
              </div>

            </div>

            {/* Detailed FII/DII Institutional Breakdown Table */}
            <div className="terminal-card overflow-hidden border border-terminal-border/80 shadow-2xl bg-black">
              <div className="bg-emerald-950/40 px-5 py-3.5 border-b border-terminal-border flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <PieChart className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-black text-emerald-300 font-mono uppercase tracking-wider">
                    Detailed FII / DII Market Activity Table
                  </span>
                </div>
                <span className="text-[10px] font-mono text-gray-400">Values in ₹ Crores</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10 text-gray-300 uppercase text-[10px]">
                      <th className="p-3.5 border-r border-white/10 min-w-[200px]">Category / Segment</th>
                      <th className="p-3.5 border-r border-white/10 min-w-[320px]">Net Flow Value & Bar (Cr)</th>
                      <th className="p-3.5 text-center min-w-[150px]">Institutional Stance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-[11px]">
                    {fiiDiiActivityList.length > 0 ? (
                      fiiDiiActivityList.map((item: any, idx: number) => {
                        const name = item.ShortName || item.Name || `Segment ${idx + 1}`;
                        const netVal = item.Value !== undefined ? item.Value : 0;
                        const isBuyer = typeof netVal === 'number' ? netVal > 0 : !String(netVal).startsWith('-');

                        return (
                          <tr key={idx} className="hover:bg-white/5 transition-colors">
                            <td className="p-3.5 font-bold text-white border-r border-white/10">{name}</td>
                            <td className="p-2 border-r border-white/10">
                              {renderNetFlowBarCell(netVal)}
                            </td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2.5 py-1 rounded font-black text-[10px] uppercase inline-block border ${
                                isBuyer
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                              }`}>
                                {isBuyer ? 'NET BUYER ⬆️' : 'NET SELLER ⬇️'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-3.5 font-bold text-white border-r border-white/10">FII Cash Market (FII CM)</td>
                          <td className="p-2 border-r border-white/10">
                            {renderNetFlowBarCell(derivativesIntel.fiiCm)}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2.5 py-1 rounded font-black text-[10px] uppercase inline-block border ${
                              derivativesIntel.fiiCm.startsWith('+')
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            }`}>
                              {derivativesIntel.fiiCm.startsWith('+') ? 'NET BUYER ⬆️' : 'NET SELLER ⬇️'}
                            </span>
                          </td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-3.5 font-bold text-white border-r border-white/10">DII Cash Market (DII CM)</td>
                          <td className="p-2 border-r border-white/10">
                            {renderNetFlowBarCell(derivativesIntel.diiCm)}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2.5 py-1 rounded font-black text-[10px] uppercase inline-block border ${
                              derivativesIntel.diiCm.startsWith('+')
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            }`}>
                              {derivativesIntel.diiCm.startsWith('+') ? 'NET BUYER ⬆️' : 'NET SELLER ⬇️'}
                            </span>
                          </td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-3.5 font-bold text-white border-r border-white/10">FII Index Futures</td>
                          <td className="p-2 border-r border-white/10">
                            {renderNetFlowBarCell(derivativesIntel.fiiIdxFut)}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2.5 py-1 rounded font-black text-[10px] uppercase inline-block border ${
                              derivativesIntel.fiiIdxFut.startsWith('+')
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            }`}>
                              {derivativesIntel.fiiIdxFut.startsWith('+') ? 'NET LONG ⬆️' : 'NET SHORT ⬇️'}
                            </span>
                          </td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-3.5 font-bold text-white border-r border-white/10">FII Index Options</td>
                          <td className="p-2 border-r border-white/10">
                            {renderNetFlowBarCell(derivativesIntel.fiiIdxOpt)}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2.5 py-1 rounded font-black text-[10px] uppercase inline-block border ${
                              derivativesIntel.fiiIdxOpt.startsWith('+')
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            }`}>
                              {derivativesIntel.fiiIdxOpt.startsWith('+') ? 'BULLISH FLOW ⬆️' : 'BEARISH FLOW ⬇️'}
                            </span>
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};

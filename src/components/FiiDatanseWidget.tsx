import React, { useState, useEffect } from 'react';
import { RefreshCw, Zap, TrendingDown, TrendingUp, CheckCircle, AlertCircle, Server, Activity, Database } from 'lucide-react';

export interface FiiSentimentData {
  success: boolean;
  error?: string;
  source: string;
  date: string;
  systemMarketBias: string;
  biasDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  fiiIndexFutures: {
    netContracts: number;
    formatted: string;
    stance: string;
  };
  derivativesIntelligence: {
    fiiCm: string;
    diiCm: string;
    fiiIdxFut: string;
    fiiIdxOpt: string;
  };
  participants: Array<{
    name: string;
    sentiment: string;
    netIndexFut: number;
  }>;
  rawParticipantOI?: any[];
}

interface FiiDatanseWidgetProps {
  onSyncWithMasterSignal?: (bias: string, participants: any[], date: string) => void;
  isMasterSignalSynced?: boolean;
  onToggleMasterSignalSync?: (synced: boolean) => void;
}

export const FiiDatanseWidget: React.FC<FiiDatanseWidgetProps> = ({
  onSyncWithMasterSignal,
  isMasterSignalSynced = true,
  onToggleMasterSignalSync
}) => {
  const [data, setData] = useState<FiiSentimentData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string>('');

  const fetchFiiSentiment = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = typeof window !== 'undefined' && window.location && window.location.origin
        ? `${window.location.origin}/api/fii-sentiment`
        : '/api/fii-sentiment';

      const res = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch FII Sentiment (HTTP ${res.status})`);
      }

      const json: FiiSentimentData = await res.json();
      if (!json || !json.success) {
        throw new Error(json?.error || 'Failed to parse FII sentiment from datanse.onrender.com');
      }

      setData(json);
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setLastFetched(`${hours}:${minutes}:${seconds}`);

      if (isMasterSignalSynced && onSyncWithMasterSignal && json.systemMarketBias) {
        try {
          onSyncWithMasterSignal(json.systemMarketBias, json.participants || [], json.date || '');
        } catch (syncErr) {
          console.warn('[FiiDatanseWidget Sync Warning]:', syncErr);
        }
      }
    } catch (err: any) {
      console.error('[FiiDatanseWidget Error]:', err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes('pattern') || errMsg.includes('SyntaxError') || errMsg.includes('AbortError')) {
        setError('Unable to fetch live FII sentiment feed. Click Retry to reload.');
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiiSentiment();
  }, []);

  const getBiasBgColor = (bias: string) => {
    if (bias.includes('GOES DOWN') || bias.includes('BEARISH')) {
      return 'bg-red-950/40 border-red-500/50 text-red-400';
    }
    if (bias.includes('GOES UP') || bias.includes('BULLISH')) {
      return 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400';
    }
    return 'bg-amber-950/40 border-amber-500/50 text-amber-400';
  };

  const getFlowTextColor = (valStr: string) => {
    if (!valStr || valStr === 'N/A') return 'text-gray-400';
    if (valStr.startsWith('+')) return 'text-emerald-400';
    if (valStr.startsWith('-')) return 'text-red-400';
    return 'text-gray-300';
  };

  return (
    <div className="terminal-card p-5 border border-terminal-border bg-black/60 rounded-xl space-y-4 shadow-2xl">
      {/* Top Bar Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-terminal-accent/10 border border-terminal-accent/20">
            <Activity className="w-4 h-4 text-terminal-accent" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                FII SENTIMENT & BIAS
              </h3>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-terminal-accent/20 text-terminal-accent font-bold">
                COMPUTED METRICS
              </span>
            </div>
            <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
              <Server className="w-3 h-3 text-emerald-400" />
              Source: <span className="text-emerald-400 font-mono">datanse.onrender.com</span> live API feed
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Master Signal Feed Source Switcher */}
          {onToggleMasterSignalSync && (
            <button
              onClick={() => {
                const nextVal = !isMasterSignalSynced;
                onToggleMasterSignalSync(nextVal);
                if (!nextVal && data && onSyncWithMasterSignal) {
                  onSyncWithMasterSignal(data.systemMarketBias, data.participants, data.date);
                }
              }}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all border cursor-pointer ${
                !isMasterSignalSynced
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-950/50'
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
              }`}
              title="Switch between datanse.onrender.com Live Feed and Sheet Data"
            >
              <Zap className={`w-3 h-3 ${!isMasterSignalSynced ? 'text-cyan-400 animate-pulse' : 'text-emerald-400'}`} />
              <span>{!isMasterSignalSynced ? 'DATANSE LIVE FEED ACTIVE' : 'Switch to Datanse Live'}</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            onClick={fetchFiiSentiment}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all disabled:opacity-50"
            title="Refresh FII Sentiment & Bias from datanse.onrender.com"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-terminal-accent' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Body */}
      {loading && !data ? (
        <div className="py-8 flex flex-col items-center justify-center space-y-2 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin text-terminal-accent" />
          <span className="text-xs font-mono">Fetching FII Sentiment from datanse.onrender.com...</span>
        </div>
      ) : error ? (
        <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-lg flex items-center justify-between text-xs text-red-400">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchFiiSentiment} className="underline text-white font-bold ml-2">Retry</button>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* System Market Bias Main Card */}
          <div className="md:col-span-6 space-y-3">
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${getBiasBgColor(data.systemMarketBias)} shadow-lg`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-gray-300 font-bold">
                  SYSTEM MARKET BIAS
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-gray-200">
                  SESSION: {data.date}
                </span>
              </div>
              <div className="text-xl md:text-2xl font-black uppercase tracking-tight py-2 text-center drop-shadow">
                {data.systemMarketBias}
              </div>
              <div className="text-[9px] font-mono text-center text-gray-300 mt-1">
                Computed from live FII Index Futures & Participant Net Positions
              </div>
            </div>

            {/* FII Index Futures Subcard */}
            <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-gray-400 uppercase block">FII INDEX FUTURES</span>
                <span className="text-lg font-black text-white font-mono">{data.fiiIndexFutures.formatted}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 block font-mono">STANCE</span>
                <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase inline-block mt-0.5 ${
                  data.fiiIndexFutures.stance.includes('SHORT')
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {data.fiiIndexFutures.stance}
                </span>
              </div>
            </div>
          </div>

          {/* Derivatives Trend Intelligence */}
          <div className="md:col-span-6 p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wide">
                Derivatives Trend Intelligence
              </span>
              <span className="text-[9px] font-mono text-gray-400 bg-black/30 px-2 py-0.5 rounded">
                SESSION: {data.date}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {/* FII CM */}
              <div className="p-2.5 bg-black/40 border border-white/5 rounded-lg">
                <span className="text-[9px] font-mono text-gray-400 block uppercase">FII CM (NET FLOW)</span>
                <span className={`text-sm font-black font-mono ${getFlowTextColor(data.derivativesIntelligence.fiiCm)}`}>
                  {data.derivativesIntelligence.fiiCm}
                </span>
              </div>

              {/* DII CM */}
              <div className="p-2.5 bg-black/40 border border-white/5 rounded-lg">
                <span className="text-[9px] font-mono text-gray-400 block uppercase">DII CM (NET FLOW)</span>
                <span className={`text-sm font-black font-mono ${getFlowTextColor(data.derivativesIntelligence.diiCm)}`}>
                  {data.derivativesIntelligence.diiCm}
                </span>
              </div>

              {/* FII IDX FUT */}
              <div className="p-2.5 bg-black/40 border border-white/5 rounded-lg">
                <span className="text-[9px] font-mono text-gray-400 block uppercase">FII IDX FUT (NET)</span>
                <span className={`text-sm font-black font-mono ${getFlowTextColor(data.derivativesIntelligence.fiiIdxFut)}`}>
                  {data.derivativesIntelligence.fiiIdxFut}
                </span>
              </div>

              {/* FII IDX OPT */}
              <div className="p-2.5 bg-black/40 border border-white/5 rounded-lg">
                <span className="text-[9px] font-mono text-gray-400 block uppercase">FII IDX OPT (NET)</span>
                <span className={`text-sm font-black font-mono ${getFlowTextColor(data.derivativesIntelligence.fiiIdxOpt)}`}>
                  {data.derivativesIntelligence.fiiIdxOpt}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[9px] text-gray-500 border-t border-white/5 pt-2">
        <span>Auto-Fetched from datanse.onrender.com</span>
        {lastFetched && <span>Last Sync: {lastFetched}</span>}
      </div>
    </div>
  );
};

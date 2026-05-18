'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatUnits } from 'viem'
import {
  ArrowUpFromLine, CheckCircle2, Loader2, Shield, X, Activity, Droplets, Copy, LogOut, Link2, Check, FileText
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { getActiveConfig } from './utils/constants'
import { useWallet } from './hooks/useWallet'
import { useVault } from './hooks/useVault'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import type { StatementData } from '../types'

const PREVIEW_CHART_DATA = [
  { month: 'Mar', inbound: 4200, outbound: 1800, net: 2400 },
  { month: 'Apr', inbound: 5800, outbound: 2200, net: 3600 },
  { month: 'May', inbound: 7500, outbound: 2800, net: 4700 },
  { month: 'Jun', inbound: 9100, outbound: 3100, net: 6000 },
  { month: 'Jul', inbound: 11500, outbound: 3800, net: 7700 },
]

export default function Home() {
  const { address, isConnected, connectWallet, disconnectWallet, isConnecting, isMiniPay, chainId: walletChainId } = useWallet()
  const {
    balance, score, treasuryData, vaultBalances,
    depositStage, depositError, handleDeposit, handleWithdraw,
    showSuccessToast, dismissToast, syncProfile
  } = useVault()

  const config = getActiveConfig()
  const [depositAmount, setDepositAmount] = useState('')
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [selectedToken, setSelectedToken] = useState<'USDC' | 'cUSD' | 'USDT'>('USDC')

  const [statementData, setStatementData] = useState<StatementData | null>(null)
  const [isStatementLoading, setIsStatementLoading] = useState(false)

  const fetchStatement = useCallback(async () => {
    if (!address) return
    setIsStatementLoading(true)
    try {
      const res = await fetch(`/api/statement?address=${address}`)
      if (res.ok) {
        const data = await res.json()
        setStatementData(data)
      }
    } catch (e) {
      console.error('Failed to fetch statement:', e)
    } finally {
      setIsStatementLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (isConnected && address) {
      void fetchStatement()
    } else {
      setStatementData(null)
    }
  }, [isConnected, address, fetchStatement])

  const combinedTotal = balance + treasuryData.aggregateBalance
  const displayBalance = parseFloat(formatUnits(combinedTotal, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const numericScore = Number(score)
  const isPending = depositStage === 'approving' || depositStage === 'depositing' || depositStage === 'withdrawing'

  // Radial Liquid Fill Score (0 - 100) since max score is 1000
  const fillPercentage = Math.min(Math.max(((numericScore + Number(formatUnits(combinedTotal, 18))) / 1000) * 100, 0), 100)

  // Trigger Confetti on completion
  useEffect(() => {
    if (depositStage === 'confirmed') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#35D07F', '#4A00E0', '#ffffff']
      })
    }
  }, [depositStage])

  const copyToClipboard = useCallback(() => {
    if (address) {
      void navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [address])

  const reputationTier = useMemo(() => {
    const allBalancesAreZero = balance === 0n && treasuryData.aggregateBalance === 0n
    if (numericScore === 0 || allBalancesAreZero) return 'INITIATING REPUTATION'
    if (numericScore <= 100) return 'TIER 1: EMERGING MERCHANT'
    if (numericScore <= 500) return 'TIER 2: TRUSTED VENDOR'
    return 'TIER 3: INSTITUTIONAL GRADE'
  }, [numericScore, balance, treasuryData.aggregateBalance])

  const chartData = useMemo(() => {
    if (statementData?.monthlyBreakdown && statementData.monthlyBreakdown.length > 0) {
      return statementData.monthlyBreakdown.map((item) => ({
        month: item.month,
        inbound: parseFloat(item.inbound),
        outbound: parseFloat(item.outbound),
        net: parseFloat(item.net),
      }))
    }
    return PREVIEW_CHART_DATA
  }, [statementData])

  // Simple identicon gradient based on address
  const identiconGradient = useMemo(() => {
    if (!address) return 'linear-gradient(135deg, #333 0%, #111 100%)'
    const color1 = `#${address.slice(2, 8)}`
    const color2 = `#${address.slice(36, 42)}`
    return `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`
  }, [address])

  const isChainMismatch = walletChainId !== null && walletChainId !== config.CHAIN_ID
  const networkStatusColor = isChainMismatch ? 'bg-yellow-500' : walletChainId === null ? 'bg-red-500' : 'bg-lumina-emerald'

  return (
    <main className="min-h-screen pb-32 p-4 pt-12 text-white selection:bg-lumina-emerald/30 font-sans">
      
      {/* ── Success Toast ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div initial={{ opacity: 0, y: -20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed left-1/2 top-10 z-50 flex w-[90%] max-w-sm items-center gap-3 rounded-lg border border-lumina-emerald/40 bg-carbon-900/90 p-4 shadow-emerald-glow backdrop-blur-xl font-sans">
            <CheckCircle2 className="h-5 w-5 text-lumina-emerald" />
            <div className="flex-1">
              <p className="text-[10px] tracking-widest text-white/50 uppercase font-semibold">Handshake Confirmed</p>
              <p className="text-sm font-medium text-white">Business cargo vaulted</p>
            </div>
            <button onClick={dismissToast} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-2xl space-y-4">
        
        {/* ── Top Header / Network Indicator ─────────────────────── */}
        <header className="flex justify-between items-center px-2 py-2">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${networkStatusColor} ${networkStatusColor === 'bg-lumina-emerald' ? 'animate-pulse shadow-emerald-glow' : ''}`}></div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">{config.NAME}</span>
          </div>
          <div className="text-[10px] font-mono tracking-widest text-white/30 uppercase bg-white/5 px-2 py-1 rounded">
            CIP-64
          </div>
        </header>

        {/* ── Identity Header (Zero Layout Shift Container) ─────────── */}
        {!isMiniPay && (
          <section className="h-[76px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              {isConnected && address ? (
                <motion.div 
                  key="connected"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="w-full glass-panel relative flex h-full items-center justify-between rounded-2xl p-4 sm:p-5 border border-white/10 backdrop-blur-[16px] max-[380px]:px-3"
                >
                  <div className="flex items-center gap-3 sm:gap-4 max-[380px]:gap-2">
                    <div 
                      className="h-8 w-8 sm:h-10 sm:w-10 rounded-full border border-white/20 shadow-inner shrink-0" 
                      style={{ background: identiconGradient }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm font-display font-medium text-white tracking-wider">
                          {`${address.slice(0, 6)}...${address.slice(-4)}`}
                        </p>
                        <div className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-lumina-emerald animate-pulse shadow-emerald-glow shrink-0"></span>
                          <span className="text-[8px] sm:text-[9px] text-white/40 uppercase tracking-widest font-semibold">ACTIVE</span>
                        </div>
                      </div>
                      <p className="text-[9px] sm:text-[10px] font-bold tracking-widest text-white/40 uppercase mt-0.5 max-[380px]:text-[8px]">TRUST ANCHOR ACTIVE</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="relative flex items-center justify-center">
                      <button onClick={copyToClipboard} className="p-2 sm:p-2.5 rounded-xl hover:bg-white/10 transition-colors group relative" aria-label="Copy Address">
                        {copied ? (
                          <Check className="h-4 w-4 sm:h-5 sm:w-5 text-lumina-emerald" />
                        ) : (
                          <Copy className="h-4 w-4 sm:h-5 sm:w-5 text-white/50 group-hover:text-white" />
                        )}
                      </button>
                      <AnimatePresence>
                        {copied && (
                          <motion.div 
                            initial={{ opacity: 0, y: 5 }} 
                            animate={{ opacity: 1, y: -25 }} 
                            exit={{ opacity: 0 }} 
                            className="absolute text-[8px] sm:text-[10px] bg-white text-black px-2 py-1 rounded font-bold tracking-widest pointer-events-none whitespace-nowrap z-30"
                          >
                            COPIED
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    
                    <button onClick={disconnectWallet} className="p-2 sm:p-2.5 rounded-xl hover:bg-[#ff4d4d]/20 text-white/50 hover:text-[#ff4d4d] transition-colors group" aria-label="Disconnect Wallet">
                      <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.button 
                  key="disconnected"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  onClick={connectWallet} 
                  disabled={isConnecting}
                  className="w-full glass-panel relative flex h-full items-center justify-center rounded-2xl transition-all border border-lumina-emerald/30 hover:border-lumina-emerald/80 hover:shadow-[0_0_24px_rgba(53,208,127,0.2)] overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-lumina-emerald/5 group-hover:bg-lumina-emerald/10 transition-colors"></div>
                  <div className="relative z-10 flex items-center gap-3">
                    {isConnecting ? (
                      <Loader2 className="h-5 w-5 text-lumina-emerald animate-spin" />
                    ) : (
                      <Link2 className="h-5 w-5 text-lumina-emerald animate-pulse" />
                    )}
                    <span className="text-[11px] sm:text-xs font-bold tracking-[0.2em] text-lumina-emerald uppercase">
                      {isConnecting ? 'SYNCING IDENTITY...' : '[ UNLINKED ] ACTIVATE BUSINESS IDENTITY'}
                    </span>
                  </div>
                </motion.button>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* ── Bento Grid ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* Revenue Pulse (Wide Card) */}
          <div className="col-span-2 glass-panel rounded-3xl p-6 relative overflow-hidden group border border-white/10">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Activity className="w-24 h-24" />
            </div>
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[11px] font-semibold tracking-widest text-white/40 uppercase mb-1 font-display">Combined Cashflow Pulse</p>
                <div className="flex items-baseline gap-1 relative z-10 font-display">
                  <span className="font-display text-2xl sm:text-3xl text-white/30 font-bold mr-1">$</span>
                  <span className="font-display text-4xl sm:text-5xl text-white tracking-tight font-medium">{displayBalance}</span>
                  <span className="font-display text-[9px] tracking-widest text-white/40 uppercase font-semibold ml-3 bg-white/5 px-2 py-0.5 rounded border border-white/5">AGGREGATE</span>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-[9px] font-mono bg-white/5 border border-white/10 text-white/60 px-2 py-0.5 rounded uppercase tracking-wider">90D Ledgers</span>
              </div>
            </div>

            {/* Recharts Area Chart for combined flows */}
            <div className="h-44 w-full mt-4 -mx-4 relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#35D07F" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#35D07F" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff4d4d" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#ff4d4d" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ background: 'rgba(10, 10, 10, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    labelStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 'bold' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="inbound" stroke="#35D07F" strokeWidth={2} fillOpacity={1} fill="url(#colorInbound)" name="Inbound" />
                  <Area type="monotone" dataKey="outbound" stroke="#ff4d4d" strokeWidth={1.5} fillOpacity={1} fill="url(#colorOutbound)" name="Outflow" strokeDasharray="3 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Granular Asset Split (Wide Card) */}
          <div className="col-span-2 glass-panel rounded-3xl p-6 border border-white/10 relative overflow-hidden">
            <h4 className="text-[11px] font-semibold tracking-widest text-white/40 uppercase mb-4 font-display">Asset Split Breakdown</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* USDC */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-white/10 transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-white/60 tracking-wider">USDC</span>
                  <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]"></span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[9px] text-white/40 uppercase">Wallet:</span>
                    <span className="text-xs font-mono font-medium text-white">
                      {parseFloat(formatUnits(treasuryData.usdc, 6)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[9px] text-white/40 uppercase">Vaulted:</span>
                    <span className="text-xs font-mono font-bold text-lumina-emerald">
                      {parseFloat(formatUnits(vaultBalances.usdc, 6)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* cUSD */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-white/10 transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-white/60 tracking-wider">cUSD</span>
                  <span className="h-2 w-2 rounded-full bg-lumina-emerald shadow-[0_0_8px_rgba(53,208,127,0.5)]"></span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[9px] text-white/40 uppercase">Wallet:</span>
                    <span className="text-xs font-mono font-medium text-white">
                      {parseFloat(formatUnits(treasuryData.cusd, 18)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[9px] text-white/40 uppercase">Vaulted:</span>
                    <span className="text-xs font-mono font-bold text-lumina-emerald">
                      {parseFloat(formatUnits(vaultBalances.cusd, 18)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* USDT */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-white/10 transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-white/60 tracking-wider">USDT</span>
                  <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[9px] text-white/40 uppercase">Wallet:</span>
                    <span className="text-xs font-mono font-medium text-white">
                      {parseFloat(formatUnits(treasuryData.usdt, 6)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[9px] text-white/40 uppercase">Vaulted:</span>
                    <span className="text-xs font-mono font-bold text-lumina-emerald">
                      {parseFloat(formatUnits(vaultBalances.usdt, 6)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reputation Card (Square, Radial Liquid-Fill) */}
          <div className="col-span-1 glass-panel rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between aspect-square border border-white/10">
            <div className="flex justify-between items-start z-10">
              <p className="text-[10px] font-bold tracking-widest text-white/50 uppercase leading-tight">Reputation<br/>Score</p>
              <Droplets className="w-4 h-4 text-lumina-emerald/50" />
            </div>

            {/* High-fidelity Radial Liquid Gauge */}
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center z-10 my-2">
              <div className="absolute inset-0 rounded-full border border-lumina-emerald/20 shadow-[0_0_16px_rgba(53,208,127,0.1)]"></div>
              <div className="absolute inset-1 rounded-full border border-dashed border-lumina-emerald/30 animate-[spin_60s_linear_infinite]"></div>
              
              <div className="relative w-20 h-20 rounded-full overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center">
                {/* wave animated backgrounds */}
                <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
                  <motion.div 
                    className="absolute w-[200%] h-[200%] -left-[50%] bg-lumina-emerald/50"
                    style={{ borderRadius: '38%', top: `${100 - fillPercentage}%` }}
                    animate={{ rotate: [0, 360] }}
                    transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                  />
                  <motion.div 
                    className="absolute w-[200%] h-[200%] -left-[50%] bg-lumina-emerald/30"
                    style={{ borderRadius: '42%', top: `${100 - fillPercentage}%` }}
                    animate={{ rotate: [360, 0] }}
                    transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                  />
                </div>

                <div className="relative z-10 text-center">
                  <span className="font-display text-2xl font-extrabold text-white tracking-tight drop-shadow-md">
                    {numericScore}
                  </span>
                  <span className="block text-[6px] text-white/50 tracking-widest uppercase font-bold mt-0.5">SCORE</span>
                </div>
              </div>
            </div>

            <div className="z-10 text-center">
              <p className="text-[7px] text-white/50 uppercase tracking-[0.15em] font-bold truncate">{reputationTier}</p>
            </div>
          </div>

          {/* Network Intel Card */}
          <div className="col-span-1 glass-panel rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between aspect-square border border-white/10">
            <p className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Network</p>
            <div>
              <p className="text-xs text-white/80 font-mono mb-2">CHAIN: {config.CHAIN_ID}</p>
              <div className="h-px w-full bg-white/10 mb-2"></div>
              <p className="text-[10px] text-white/40 font-mono">GAS ASSET: {selectedToken}</p>
              <p className="text-[10px] text-lumina-emerald font-mono mt-1 uppercase tracking-widest font-bold">100% Gasless</p>
            </div>
          </div>

          {/* Vault Controls Card */}
          <div className="col-span-2 glass-panel rounded-3xl p-6 border border-white/10 relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-[11px] font-semibold tracking-widest text-white/40 uppercase font-display">Vault Controls</h4>
              <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
                <button 
                  onClick={() => setActiveTab('deposit')} 
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${activeTab === 'deposit' ? 'bg-lumina-emerald text-black shadow-md' : 'text-white/60 hover:text-white'}`}
                >
                  Revenue Inbound
                </button>
                <button 
                  onClick={() => setActiveTab('withdraw')} 
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${activeTab === 'withdraw' ? 'bg-lumina-emerald text-black shadow-md' : 'text-white/60 hover:text-white'}`}
                >
                  Operational Outflow
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Select Token:</span>
                <div className="flex gap-2">
                  {(['USDC', 'cUSD', 'USDT'] as const).map((token) => (
                    <button
                      key={token}
                      onClick={() => setSelectedToken(token)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                        selectedToken === token
                          ? 'bg-white/10 border-lumina-emerald text-lumina-emerald shadow-inner'
                          : 'border-white/5 bg-white/5 text-white/60 hover:border-white/15'
                      }`}
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs text-white/60 font-medium">
                {activeTab === 'deposit' ? (
                  <p>Inbound cargo will be authorized, and stable capital will be stitched securely into the Celo Mainnet Universal Anchor.</p>
                ) : (
                  <p>Operational reserves will be released and withdrawn safely back to the business trust anchor wallet instantly.</p>
                )}
              </div>
            </div>
          </div>

          {/* Proof of Cashflow Financial Statement Section */}
          {isConnected && address && (
            <section className="col-span-2 glass-panel rounded-3xl p-6 border border-white/10 relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h4 className="text-[11px] font-semibold tracking-widest text-white/40 uppercase font-display">Proof of Cashflow</h4>
                  <p className="text-xs text-white/60">Audited historical business record via Covalent ledger sync</p>
                </div>
                <button 
                  onClick={fetchStatement} 
                  disabled={isStatementLoading}
                  className="bg-white/5 border border-white/10 hover:bg-white/10 text-white text-[10px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-xl transition-all"
                >
                  {isStatementLoading ? 'Auditing...' : 'Refresh Audit'}
                </button>
              </div>

              {statementData ? (
                <div className="space-y-6">
                  {/* stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                      <span className="block text-[8px] text-white/40 uppercase font-bold tracking-wider mb-1">Monthly Revenue (MRR)</span>
                      <span className="text-lg font-mono font-bold text-lumina-emerald">${parseFloat(statementData.summary.mrr).toFixed(2)}</span>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                      <span className="block text-[8px] text-white/40 uppercase font-bold tracking-wider mb-1">Net Flow</span>
                      <span className="text-lg font-mono font-bold text-white">${parseFloat(statementData.summary.netFlow).toFixed(2)}</span>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                      <span className="block text-[8px] text-white/40 uppercase font-bold tracking-wider mb-1">Churn Volatility</span>
                      <span className="text-lg font-mono font-bold text-white">{parseFloat(statementData.summary.churnVolatility).toFixed(2)}d</span>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                      <span className="block text-[8px] text-white/40 uppercase font-bold tracking-wider mb-1">Avg Deposit Gap</span>
                      <span className="text-lg font-mono font-bold text-white">{parseFloat(statementData.summary.avgDaysBetweenDeposits).toFixed(2)}d</span>
                    </div>
                  </div>

                  {/* Mento Local Currency Valuations */}
                  {statementData.localValuation && statementData.localValuation.length > 0 && (
                    <div>
                      <h5 className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-3">Mento Local Parity</h5>
                      <div className="grid grid-cols-3 gap-2">
                        {statementData.localValuation.map((val) => (
                          <div key={val.currency} className="bg-white/5 border border-white/5 rounded-xl p-3 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-white/60 font-mono">{val.currency}</span>
                            <div className="text-right">
                              <span className="block text-xs font-mono font-bold text-white">{parseFloat(val.mrrLocal).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              <span className="text-[7px] text-white/40 uppercase tracking-widest">MRR Equiv</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Transfer History list */}
                  <div>
                    <h5 className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-3">Audited Log (Last 90 Days)</h5>
                    <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {statementData.transfers && statementData.transfers.length > 0 ? (
                        statementData.transfers.map((tx) => (
                          <div key={tx.hash} className="bg-white/5 border border-white/5 rounded-xl p-3 flex justify-between items-center text-[10px]">
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase ${tx.direction === 'inbound' ? 'bg-lumina-emerald/20 text-lumina-emerald' : 'bg-red-400/20 text-red-400'}`}>
                                {tx.direction}
                              </span>
                              <span className="font-mono text-white/60">{tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}</span>
                            </div>
                            <span className="font-mono font-bold text-white">${parseFloat(tx.amount).toFixed(2)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest text-center py-4">No merchant cargo flow logged.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-8 text-center">
                  <FileText className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/60 mb-3">Audited financial data generated deterministically via Covalent ledger sync.</p>
                  <button 
                    onClick={fetchStatement} 
                    disabled={isStatementLoading}
                    className="bg-lumina-emerald hover:brightness-110 text-black text-[10px] font-bold tracking-widest uppercase px-4 py-2 rounded-xl transition-all"
                  >
                    {isStatementLoading ? 'Generating Attestation...' : 'Generate Proof of Cashflow'}
                  </button>
                </div>
              )}
            </section>
          )}

        </div>
      </div>

      {/* ── Fixed Handshake Bar (Bottom) ────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 z-40 bg-gradient-to-t from-black via-black/80 to-transparent pt-12 pb-6">
        <div className="mx-auto max-w-2xl">
          <div className="glass-panel p-2 rounded-2xl flex items-center gap-2 border-white/10 shadow-2xl backdrop-blur-3xl bg-black/40">
            <div className="relative flex-1">
              <input 
                type="number" 
                value={depositAmount} 
                onChange={(e) => setDepositAmount(e.target.value)} 
                placeholder="0.00"
                className="w-full bg-transparent px-4 py-3 font-display text-2xl text-white outline-none placeholder:text-white/20"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/30 uppercase tracking-widest font-sans">
                {selectedToken}
              </div>
            </div>

            <button 
              onClick={() => {
                if (activeTab === 'deposit') {
                  void handleDeposit(selectedToken, depositAmount)
                } else {
                  void handleWithdraw(selectedToken, depositAmount)
                }
              }} 
              disabled={isPending || !depositAmount}
              className="group relative flex items-center justify-center gap-2 h-14 px-8 rounded-xl bg-lumina-emerald text-black font-bold text-xs tracking-widest uppercase transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-[0_0_24px_rgba(53,208,127,0.3)] shrink-0"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpFromLine className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {activeTab === 'deposit' ? (
                  depositStage === 'approving' ? 'AUTHORIZING CARGO...' : depositStage === 'depositing' ? 'STITCHING RESERVES...' : 'Confirm Inbound Handshake'
                ) : (
                  depositStage === 'withdrawing' ? 'RELEASING RESERVES...' : 'Confirm Outflow Handshake'
                )}
              </span>
              <span className="sm:hidden">
                {activeTab === 'deposit' ? (
                  depositStage === 'approving' ? 'AUTH...' : depositStage === 'depositing' ? 'STITCHING...' : 'Inbound'
                ) : (
                  depositStage === 'withdrawing' ? 'RELEASING...' : 'Outflow'
                )}
              </span>
            </button>
          </div>
          
          {depositError && (
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-center text-[10px] text-red-400 font-bold uppercase tracking-widest font-sans animate-pulse">
              {depositError}
            </motion.p>
          )}
        </div>
      </div>

    </main>
  )
}

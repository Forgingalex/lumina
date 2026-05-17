'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatUnits } from 'viem'
import {
  ArrowUpFromLine, CheckCircle2, Loader2, Shield, X, Activity, Droplets, Copy, LogOut, Link2, Check
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { getActiveConfig } from './utils/constants'
import { useWallet } from './hooks/useWallet'
import { useVault } from './hooks/useVault'

export default function Home() {
  const { address, isConnected, connectWallet, disconnectWallet, isConnecting, isMiniPay, chainId: walletChainId } = useWallet()
  const {
    balance, score, treasuryData,
    depositStage, depositError, handleDeposit,
    showSuccessToast, dismissToast,
  } = useVault()

  const config = getActiveConfig()
  const [depositAmount, setDepositAmount] = useState('')
  const [copied, setCopied] = useState(false)

  const combinedTotal = balance + treasuryData.aggregateBalance
  const displayBalance = parseFloat(formatUnits(combinedTotal, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const numericScore = Number(score)
  const isPending = depositStage === 'approving' || depositStage === 'depositing'

  // Radial Liquid Fill Score (0 - 100) since max score is 1000
  // Reacts to the combined activity of all supported assets
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

  const activeFeeCurrencyLabel = useMemo(() => {
    if (treasuryData.usdc > 0n) return 'USDC'
    if (treasuryData.cusd > 0n) return 'cUSD'
    if (treasuryData.usdt > 0n) return 'USDT'
    return 'USDC'
  }, [treasuryData])

  const dynamicPath = useMemo(() => {
    // A base height that changes depending on the balance value
    const totalVal = parseFloat(formatUnits(combinedTotal, 18))
    const scale = Math.max(0.2, Math.min(2.0, totalVal / 100))
    const p1 = Math.max(5, 50 - 40 * scale)
    const p2 = Math.max(5, 50 - 10 * scale)
    const p3 = Math.max(5, 50 - 30 * scale)
    return `M0,50 C40,50 60,${p1} 100,${p1} C140,${p1} 160,${p2} 200,${p2} C240,${p2} 260,${p3} 300,${p3} C340,${p3} 360,50 400,50`
  }, [combinedTotal])

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

        {/* ── Bento Grid ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* Revenue Pulse (Wide Card) */}
          <div className="col-span-2 glass-panel rounded-3xl p-6 relative overflow-hidden group border border-white/10">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Activity className="w-24 h-24" />
            </div>
            
            <p className="text-[11px] font-semibold tracking-widest text-white/40 uppercase mb-2 font-display">Operational Capital</p>
            <div className="flex items-baseline gap-1 mb-2 relative z-10 font-display">
              <span className="font-display text-3xl sm:text-4xl text-white/30 font-bold mr-1">$</span>
              <span className="font-display text-5xl sm:text-6xl text-white tracking-tight font-medium">{displayBalance}</span>
              <span className="font-display text-[9px] tracking-widest text-white/40 uppercase font-semibold ml-3 bg-white/5 px-2 py-0.5 rounded border border-white/5">STABLE ASSETS</span>
            </div>

            {/* Liquidity Breakdown */}
            <div className="mb-6 flex flex-wrap gap-2 items-center text-[10px] font-mono text-white/60 tracking-wider relative z-10">
              <span className="text-white/40 uppercase font-bold tracking-widest bg-white/5 px-1.5 py-0.5 rounded font-display text-[8px] border border-white/5">Split:</span>
              <span className="text-lumina-emerald">{parseFloat(formatUnits(treasuryData.usdc, 18)).toFixed(2)} USDC</span>
              <span className="text-white/20">|</span>
              <span className="text-lumina-emerald">{parseFloat(formatUnits(treasuryData.cusd, 18)).toFixed(2)} cUSD</span>
              <span className="text-white/20">|</span>
              <span className="text-lumina-emerald">{parseFloat(formatUnits(treasuryData.usdt, 18)).toFixed(2)} USDT</span>
              <span className="text-white/20">|</span>
              <span className="text-white/40">Vaulted: {parseFloat(formatUnits(balance, 18)).toFixed(2)} USDC</span>
            </div>

            {/* Animated SVG Path for Cashflow */}
            <div className="h-16 w-full relative -mx-2">
              <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 400 60">
                <motion.path 
                  d={dynamicPath} 
                  fill="none" 
                  stroke="url(#pulse-gradient)" 
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 2.5, ease: "easeInOut" }}
                  className="drop-shadow-[0_0_8px_rgba(53,208,127,0.8)]"
                />
                <defs>
                  <linearGradient id="pulse-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(53,208,127,0.1)" />
                    <stop offset="50%" stopColor="#35D07F" />
                    <stop offset="100%" stopColor="rgba(53,208,127,0.1)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          {/* Reputation Card (Square, Radial Liquid-Fill) */}
          <div className="col-span-1 glass-panel rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between aspect-square border border-white/10">
            <div className="flex justify-between items-start z-10">
              <p className="text-[10px] font-bold tracking-widest text-white/50 uppercase leading-tight">Reputation<br/>Score</p>
              <Droplets className="w-4 h-4 text-lumina-emerald/50" />
            </div>

            <div className="z-10 mt-auto">
              {numericScore === 0 ? (
                <div className="animate-pulse">
                  <p className="font-display text-2xl text-lumina-emerald tracking-tight">0</p>
                </div>
              ) : (
                <>
                  <p className="font-display text-5xl text-white tracking-tight drop-shadow-md">{numericScore}</p>
                </>
              )}
              <p className="text-[8px] sm:text-[9px] text-white/50 uppercase mt-1.5 tracking-[0.15em] font-bold">{reputationTier}</p>
            </div>

            {/* Liquid Fill Animation */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none overflow-hidden rounded-3xl">
              <motion.div 
                className="absolute w-[200%] h-[200%] -left-[50%] bg-lumina-emerald/40"
                style={{ 
                  borderRadius: '40%',
                  top: `${100 - fillPercentage}%` 
                }}
                animate={{
                  rotate: [0, 360]
                }}
                transition={{
                  repeat: Infinity,
                  duration: 8,
                  ease: "linear"
                }}
              />
              <motion.div 
                className="absolute w-[200%] h-[200%] -left-[50%] bg-lumina-emerald/60"
                style={{ 
                  borderRadius: '43%',
                  top: `${100 - fillPercentage}%` 
                }}
                animate={{
                  rotate: [360, 0]
                }}
                transition={{
                  repeat: Infinity,
                  duration: 10,
                  ease: "linear"
                }}
              />
            </div>
          </div>

          {/* Network Intel Card */}
          <div className="col-span-1 glass-panel rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between aspect-square border border-white/10">
            <p className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Network</p>
            <div>
              <p className="text-xs text-white/80 font-mono mb-2">CHAIN: {config.CHAIN_ID}</p>
              <div className="h-px w-full bg-white/10 mb-2"></div>
              <p className="text-[10px] text-white/40 font-mono">GAS: 0 {activeFeeCurrencyLabel}</p>
              <p className="text-[10px] text-lumina-emerald font-mono mt-1 uppercase tracking-widest font-bold">CIP-64 Abstraction</p>
            </div>
          </div>

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
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/30 uppercase tracking-widest font-sans">USDC</div>
            </div>

            <button 
              onClick={() => handleDeposit(depositAmount)} 
              disabled={isPending || !depositAmount}
              className="group relative flex items-center justify-center gap-2 h-14 px-8 rounded-xl bg-lumina-emerald text-black font-bold text-xs tracking-widest uppercase transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-[0_0_24px_rgba(53,208,127,0.3)] shrink-0"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpFromLine className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {depositStage === 'approving' ? 'AUTHORIZING CARGO...' : depositStage === 'depositing' ? 'STITCHING CAPITAL...' : 'Confirm Handshake'}
              </span>
              <span className="sm:hidden">
                {depositStage === 'approving' ? 'AUTH CARGO...' : depositStage === 'depositing' ? 'STITCHING...' : 'Confirm'}
              </span>
            </button>
          </div>
          
          {depositError && (
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-center text-[10px] text-red-400 font-bold uppercase tracking-widest font-sans">
              {depositError}
            </motion.p>
          )}
        </div>
      </div>

    </main>
  )
}

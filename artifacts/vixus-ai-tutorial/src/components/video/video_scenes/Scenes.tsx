import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const ease = [0.16, 1, 0.3, 1] as const;
const base = `${import.meta.env.BASE_URL}`;

type SceneProps = { currentScene?: number };

function SceneShell({
  children,
  className = '',
  accent = 'teal',
}: {
  children: ReactNode;
  className?: string;
  accent?: 'teal' | 'gold' | 'coral';
}) {
  const accentColor = accent === 'gold' ? '#f1c76c' : accent === 'coral' ? '#ef766b' : '#8bd8ce';
  return (
    <motion.div
      className={`absolute inset-0 overflow-hidden ${className}`}
      initial={{ clipPath: 'inset(0 0 100% 0)', opacity: 0 }}
      animate={{ clipPath: 'inset(0 0 0% 0)', opacity: 1 }}
      exit={{ clipPath: 'inset(0 0 0% 100%)', opacity: 0 }}
      transition={{ duration: 0.72, ease }}
      style={{ ['--scene-accent' as string]: accentColor }}
    >
      {children}
    </motion.div>
  );
}

function CornerLabel({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <span className={`eyebrow absolute top-[5.6%] ${right ? 'right-[7%] text-right' : 'left-[7%]'}`}>
      {children}
    </span>
  );
}

function Grid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-30"
      style={{
        backgroundImage:
          'linear-gradient(rgba(183,193,210,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(183,193,210,.07) 1px, transparent 1px)',
        backgroundSize: '10% 8%',
        maskImage: 'linear-gradient(to bottom, transparent, black 16%, black 82%, transparent)',
      }}
    />
  );
}

function Axis({ label }: { label: string }) {
  return (
    <div className="mono-font flex items-center justify-between text-[1.5vmin] uppercase tracking-[.16em] text-[#6f7d98]">
      <span>{label}</span>
      <span className="h-px flex-1 bg-[#b7c1d2]/10 ml-[2%]" />
    </div>
  );
}

function CandlestickChart({
  compact = false,
  highlight = 8,
}: {
  compact?: boolean;
  highlight?: number;
}) {
  const candles: Array<[number, number, number, number, boolean]> = [
    [32, 62, 47, 75, false],
    [43, 70, 55, 82, true],
    [55, 56, 39, 67, false],
    [67, 48, 31, 57, false],
    [79, 42, 27, 52, true],
    [91, 54, 38, 66, true],
    [103, 50, 30, 60, false],
    [115, 63, 43, 76, true],
    [127, 50, 35, 69, false],
    [139, 43, 22, 57, false],
    [151, 36, 19, 47, true],
    [163, 29, 15, 40, true],
    [175, 34, 23, 48, false],
    [187, 25, 11, 36, false],
    [199, 18, 6, 28, true],
  ];
  return (
    <div className={`relative w-full ${compact ? 'h-[20vmin]' : 'h-[34vmin]'}`}>
      <div className="absolute inset-0 opacity-40" style={{
        backgroundImage: 'linear-gradient(rgba(183,193,210,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(183,193,210,.1) 1px, transparent 1px)',
        backgroundSize: '25% 25%',
      }} />
      <svg viewBox="0 0 230 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <path d="M18 73 C 48 68, 68 55, 90 61 S 125 38, 147 45 S 180 19, 214 22" fill="none" stroke="#8bd8ce" strokeWidth="1.1" strokeDasharray="3 3" opacity=".55" />
        {candles.map(([x, high, low, close, up], i) => (
          <g key={i} opacity={i === highlight ? 1 : .82}>
            <line x1={x} x2={x} y1={high} y2={low} stroke={up ? '#8bd8ce' : '#ef766b'} strokeWidth={i === highlight ? 1.9 : 1.15} />
            <rect x={Number(x) - 3.2} y={Math.min(Number(close), Number(high) + 7)} width="6.4" height={Math.max(5, Math.abs(Number(close) - Number(high) - 7))} rx="1" fill={up ? '#8bd8ce' : '#ef766b'} opacity={i === highlight ? 1 : .78} />
          </g>
        ))}
      </svg>
      <div className="absolute bottom-[-2.2vmin] left-0 right-0 flex justify-between text-[1.45vmin] text-[#6f7d98] mono-font">
        <span>09:30</span><span>12:00</span><span>14:30</span><span>16:00</span>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = 'teal' }: { label: string; value: string; tone?: 'teal' | 'gold' | 'coral' }) {
  const color = tone === 'gold' ? '#f1c76c' : tone === 'coral' ? '#ef766b' : '#8bd8ce';
  return (
    <div>
      <div className="eyebrow mb-[1vmin] text-[#6f7d98]">{label}</div>
      <div className="display-font text-[4.8vmin] font-semibold tracking-[-.05em]" style={{ color }}>{value}</div>
    </div>
  );
}

export function SceneIntro() {
  return (
    <SceneShell accent="gold">
      <Grid />
      <CornerLabel>VIXUS / FIELD NOTE 01</CornerLabel>
      <CornerLabel right>AI-POWERED MARKET INTELLIGENCE</CornerLabel>
      <motion.div
        className="absolute left-[7%] top-[22%] right-[7%]"
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: .32, duration: .8, ease }}
      >
        <div className="eyebrow mb-[3.5vmin] text-gold">A visual briefing</div>
        <h1 className="display-font max-w-[86%] text-[13vmin] font-semibold leading-[.86] tracking-[-.075em]">
          What is<br /><span className="text-gold">VIXUS AI?</span>
        </h1>
        <p className="mt-[5vmin] max-w-[76%] text-[2.6vmin] leading-[1.45] text-[#b7c1d2]">
          A calmer way to read the market — from raw price movement to a decision you can explain.
        </p>
      </motion.div>
      <motion.div
        className="absolute bottom-[11%] left-[7%] flex items-center gap-[2vmin]"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: .8, duration: .65, ease }}
        style={{ transformOrigin: 'left' }}
      >
        <span className="h-[.45vmin] w-[12vmin] bg-gold" />
        <span className="mono-font text-[1.7vmin] tracking-[.12em] text-[#8e9ab8]">THE SIGNAL, DECODED</span>
      </motion.div>
      <motion.div
        className="drift absolute right-[3%] bottom-[16%] h-[24vmin] w-[24vmin] rounded-full border border-gold/30"
        initial={{ scale: .3, opacity: 0 }}
        animate={{ scale: 1, opacity: .75 }}
        transition={{ delay: .45, duration: 1.1, ease }}
      >
        <div className="absolute inset-[15%] rounded-full border border-[#8bd8ce]/30" />
        <div className="absolute left-[48%] top-[7%] h-[86%] w-px rotate-[34deg] bg-gold/60" />
      </motion.div>
    </SceneShell>
  );
}

export function ScenePresenter() {
  return (
    <SceneShell accent="teal">
      <Grid />
      <CornerLabel>01 / START WITH CONTEXT</CornerLabel>
      <motion.div
        className="absolute bottom-[4%] right-[-2%] top-[13%] w-[56%]"
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: .25, duration: 1, ease }}
      >
        <div className="absolute inset-[3%] rounded-[6vmin] border border-teal/30 bg-[radial-gradient(circle_at_50%_25%,rgba(139,216,206,.18),transparent_55%),linear-gradient(145deg,rgba(23,34,56,.72),rgba(16,24,41,.2))] shadow-[0_2vmin_8vmin_rgba(0,0,0,.28)]" />
        <div className="absolute left-[10%] right-[10%] top-[6%] h-px bg-gradient-to-r from-transparent via-teal/60 to-transparent" />
        <img
          src={`${base}presenter-card.png`}
          alt="VIXUS AI market educator explaining a signal"
          className="relative z-10 h-full w-full rounded-[5.5vmin] object-cover object-center drop-shadow-[0_2vmin_2vmin_rgba(0,0,0,.45)]"
        />
        <div className="panel absolute bottom-[4%] right-[5%] z-20 w-[78%] px-[2vmin] py-[1.4vmin]">
          <div className="mono-font text-[1.35vmin] tracking-[.14em] text-teal">VIXUS AI / MARKET EDUCATOR</div>
          <div className="mt-[.65vmin] text-[1.55vmin] text-[#f7f1e7]">Explaining the signal, not selling the outcome.</div>
        </div>
      </motion.div>
      <motion.div
        className="absolute left-[7%] top-[22%] w-[48%]"
        initial={{ y: 25, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: .6, duration: .7, ease }}
      >
        <div className="mb-[3vmin] flex items-center gap-[1.6vmin]">
          <span className="h-[1.2vmin] w-[1.2vmin] rounded-full bg-[#8bd8ce]" />
          <span className="eyebrow text-teal">The explainer</span>
        </div>
        <h2 className="display-font text-[7vmin] font-semibold leading-[.95] tracking-[-.055em]">
          Markets are<br /><span className="text-teal">too noisy</span><br />to eyeball.
        </h2>
        <p className="mt-[4vmin] max-w-[92%] text-[2.3vmin] leading-[1.5] text-[#b7c1d2]">
          VIXUS AI turns thousands of price changes into one readable story: context, setup, confidence.
        </p>
      </motion.div>
      <motion.div
        className="panel absolute bottom-[9%] left-[7%] w-[49%] p-[2.4vmin]"
        initial={{ y: 22, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.15, duration: .65, ease }}
      >
        <div className="mono-font flex items-center justify-between text-[1.5vmin] text-[#8e9ab8]">
          <span>LIVE ANALYSIS</span><span className="text-teal">● SYNCED</span>
        </div>
        <div className="mt-[1.8vmin] flex items-end justify-between">
          <Metric label="pairs watched" value="128" tone="gold" />
          <Metric label="time horizon" value="4H" />
        </div>
      </motion.div>
    </SceneShell>
  );
}

export function ScenePairs() {
  return (
    <SceneShell accent="teal">
      <Grid />
      <CornerLabel>02 / READ THE PAIR</CornerLabel>
      <motion.div className="absolute left-[7%] top-[15%] right-[7%]" initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: .2, duration: .7, ease }}>
        <div className="flex items-end justify-between">
          <div>
            <div className="eyebrow mb-[2vmin] text-teal">Market pairs</div>
            <h2 className="display-font text-[7vmin] font-semibold leading-[.94] tracking-[-.06em]">Same market.<br /><span className="text-gold">Different story.</span></h2>
          </div>
          <div className="mono-font pb-[1vmin] text-[1.6vmin] text-[#6f7d98]">12:48:06 UTC</div>
        </div>
      </motion.div>
      <motion.div className="panel absolute left-[7%] top-[43%] w-[86%] p-[3vmin]" initial={{ scale: .94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: .55, duration: .8, ease }}>
        <Axis label="relative strength / 4H" />
        <div className="mt-[3vmin] flex items-center gap-[4vmin]">
          <div className="min-w-[27%]">
            <div className="mono-font text-[2vmin] text-[#f7f1e7]">EUR / USD</div>
            <div className="mt-[1vmin] text-[2vmin] text-teal">trend aligned</div>
          </div>
          <div className="relative h-[9vmin] flex-1">
            <svg viewBox="0 0 300 50" preserveAspectRatio="none" className="h-full w-full">
              <path d="M0 37 C 28 32, 34 42, 58 30 S 88 34, 110 26 S 142 29, 163 18 S 198 25, 220 13 S 263 17, 300 5" fill="none" stroke="#8bd8ce" strokeWidth="3" />
              <path d="M0 43 C 40 39, 55 40, 80 34 S 125 34, 160 27 S 218 29, 300 16" fill="none" stroke="#8bd8ce" strokeWidth="1" opacity=".3" />
            </svg>
          </div>
          <div className="mono-font text-right text-[2.3vmin] text-teal">+0.38%</div>
        </div>
        <div className="my-[3vmin] h-px bg-[#b7c1d2]/10" />
        <div className="flex items-center gap-[4vmin]">
          <div className="min-w-[27%]">
            <div className="mono-font text-[2vmin] text-[#f7f1e7]">GBP / USD</div>
            <div className="mt-[1vmin] text-[2vmin] text-coral">momentum fading</div>
          </div>
          <div className="relative h-[9vmin] flex-1">
            <svg viewBox="0 0 300 50" preserveAspectRatio="none" className="h-full w-full">
              <path d="M0 12 C 30 10, 48 22, 70 17 S 109 28, 132 23 S 163 30, 188 26 S 230 40, 255 35 S 277 46, 300 42" fill="none" stroke="#ef766b" strokeWidth="3" />
              <path d="M0 21 C 50 19, 90 22, 140 27 S 226 34, 300 36" fill="none" stroke="#ef766b" strokeWidth="1" opacity=".3" />
            </svg>
          </div>
          <div className="mono-font text-right text-[2.3vmin] text-coral">−0.17%</div>
        </div>
      </motion.div>
      <motion.div className="absolute bottom-[10%] left-[7%] right-[7%] flex items-center justify-between" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.25, duration: .5 }}>
        <span className="text-[2vmin] text-[#b7c1d2]">VIXUS compares the signal to its surroundings.</span>
        <span className="mono-font text-[1.7vmin] text-gold">→ CONTEXT FIRST</span>
      </motion.div>
    </SceneShell>
  );
}

export function SceneCandles() {
  return (
    <SceneShell accent="gold">
      <Grid />
      <CornerLabel>03 / SEE THE SETUP</CornerLabel>
      <motion.div className="absolute left-[7%] top-[14%] right-[7%] flex items-end justify-between" initial={{ y: -18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: .18, duration: .7, ease }}>
        <div>
          <div className="eyebrow mb-[2vmin] text-gold">Price action</div>
          <h2 className="display-font text-[7.5vmin] font-semibold leading-[.9] tracking-[-.07em]">A setup is<br /><span className="text-gold">a sequence.</span></h2>
        </div>
        <div className="mono-font pb-[1vmin] text-[1.55vmin] text-[#8e9ab8]">BTC / USD · 1H</div>
      </motion.div>
      <motion.div className="panel absolute left-[7%] top-[40%] w-[86%] p-[3vmin]" initial={{ scale: .9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: .48, duration: .8, ease }}>
        <CandlestickChart highlight={14} />
        <div className="absolute left-[68%] top-[18%] h-[20%] w-[25%] border-l border-t border-gold/70">
          <span className="absolute left-[8%] top-[-3vmin] whitespace-nowrap text-[1.65vmin] text-gold">break + retest</span>
        </div>
        <div className="absolute bottom-[24%] left-[57%] h-[17%] w-[18%] rounded-full border border-teal/80" />
      </motion.div>
      <motion.div className="absolute bottom-[9%] left-[7%] flex w-[86%] justify-between" initial={{ y: 22, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.05, duration: .6, ease }}>
        {[
          ['01', 'range', 'where price has been'],
          ['02', 'break', 'what changed'],
          ['03', 'retest', 'where risk is defined'],
        ].map(([num, label, detail]) => (
          <div key={num} className="w-[30%] border-l border-[#b7c1d2]/20 pl-[2vmin]">
            <div className="mono-font text-[1.5vmin] text-[#6f7d98]">{num}</div>
            <div className="display-font mt-[1vmin] text-[3vmin] font-semibold text-[#f7f1e7]">{label}</div>
            <div className="mt-[.8vmin] text-[1.65vmin] leading-[1.3] text-[#8e9ab8]">{detail}</div>
          </div>
        ))}
      </motion.div>
    </SceneShell>
  );
}

export function SceneScore() {
  return (
    <SceneShell accent="teal">
      <Grid />
      <CornerLabel>04 / SCORE THE SIGNAL</CornerLabel>
      <motion.div className="absolute left-[7%] top-[15%] w-[82%]" initial={{ x: -35, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: .2, duration: .75, ease }}>
        <div className="eyebrow mb-[2vmin] text-teal">Decision layer</div>
        <h2 className="display-font text-[7.8vmin] font-semibold leading-[.9] tracking-[-.07em]">Not a hunch.<br /><span className="text-teal">A weighted read.</span></h2>
      </motion.div>
      <motion.div className="panel absolute left-[7%] top-[42%] w-[86%] p-[3vmin]" initial={{ rotateX: 12, y: 28, opacity: 0 }} animate={{ rotateX: 0, y: 0, opacity: 1 }} transition={{ delay: .5, duration: .85, ease }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="mono-font text-[2vmin] text-[#f7f1e7]">USD / JPY</div>
            <div className="mt-[.8vmin] text-[1.7vmin] text-[#8e9ab8]">long setup · 4H</div>
          </div>
          <div className="rounded-full border border-teal/40 bg-teal/10 px-[2vmin] py-[1vmin] mono-font text-[1.6vmin] text-teal">CONFIRMED</div>
        </div>
        <div className="mt-[4vmin] flex items-center gap-[4vmin]">
          <div className="relative h-[23vmin] w-[23vmin] shrink-0 rounded-full" style={{ background: 'conic-gradient(#8bd8ce 0deg 313deg, rgba(183,193,210,.12) 313deg 360deg)' }}>
            <div className="absolute inset-[10%] flex flex-col items-center justify-center rounded-full bg-[#172238]">
              <span className="display-font text-[7vmin] font-semibold leading-none text-teal">87</span>
              <span className="eyebrow mt-[1vmin] text-[#8e9ab8]">confidence</span>
            </div>
          </div>
          <div className="flex-1 space-y-[2.2vmin]">
            {[
              ['Trend alignment', '92%', '#8bd8ce'],
              ['Momentum', '84%', '#f1c76c'],
              ['Risk / reward', '3.1×', '#ef766b'],
            ].map(([label, val, color], i) => (
              <div key={label}>
                <div className="mb-[.8vmin] flex justify-between text-[1.65vmin] text-[#b7c1d2]"><span>{label}</span><span className="mono-font" style={{ color }}>{val}</span></div>
                <div className="h-[.8vmin] overflow-hidden rounded-full bg-[#b7c1d2]/10"><motion.div className="h-full rounded-full" style={{ backgroundColor: color }} initial={{ width: 0 }} animate={{ width: `${[92, 84, 72][i]}%` }} transition={{ delay: .85 + i * .14, duration: .7, ease }} /></div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
      <motion.p className="absolute bottom-[10%] left-[7%] text-[2vmin] text-[#b7c1d2]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.35, duration: .5 }}>
        Each input earns its weight — so the why is visible.
      </motion.p>
    </SceneShell>
  );
}

export function SceneFollow() {
  return (
    <SceneShell accent="coral">
      <Grid />
      <CornerLabel>05 / FOLLOW THROUGH</CornerLabel>
      <motion.div className="absolute left-[7%] top-[15%] right-[7%]" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2, duration: .7, ease }}>
        <div className="eyebrow mb-[2vmin] text-coral">After the alert</div>
        <h2 className="display-font text-[7.4vmin] font-semibold leading-[.9] tracking-[-.07em]">The analysis<br /><span className="text-coral">keeps watching.</span></h2>
      </motion.div>
      <motion.div className="absolute left-[7%] top-[43%] w-[86%]" initial={{ scale: .92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: .5, duration: .8, ease }}>
        <div className="relative h-[28vmin]">
          <div className="absolute left-[5%] right-[5%] top-[50%] h-px bg-[#b7c1d2]/20" />
          {[['SETUP', '09:30', 8, 'gold'], ['ENTRY', '10:15', 32, 'teal'], ['TRAIL', '12:40', 58, 'coral'], ['SETTLE', '15:55', 88, 'gold']].map(([label, time, left, tone], i) => (
            <div key={label} className="absolute top-0 flex h-full flex-col items-center" style={{ left: `${left}%` }}>
              <div className="mono-font text-[1.4vmin] text-[#6f7d98]">{time}</div>
              <div className={`my-[3.5vmin] h-[3vmin] w-[3vmin] rounded-full border-[.7vmin] border-[#101829] ${tone === 'teal' ? 'bg-[#8bd8ce]' : tone === 'coral' ? 'bg-[#ef766b]' : 'bg-[#f1c76c]'}`} />
              <div className="text-center">
                <div className="display-font text-[2.5vmin] font-semibold">{label}</div>
                <div className="mt-[.7vmin] text-[1.5vmin] text-[#8e9ab8]">{['conditions align', 'risk defined', 'protect upside', 'position closed'][i]}</div>
              </div>
            </div>
          ))}
          <motion.div className="absolute left-[5%] top-[50%] h-[.35vmin] bg-gradient-to-r from-gold via-teal to-coral" initial={{ width: 0 }} animate={{ width: '83%' }} transition={{ delay: .8, duration: 1.4, ease }} />
        </div>
      </motion.div>
      <motion.div className="panel-light absolute bottom-[10%] left-[7%] right-[7%] flex items-center justify-between p-[2.3vmin]" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.25, duration: .55, ease }}>
        <span className="text-[1.8vmin] text-[#f7f1e7]">Signal status</span>
        <span className="mono-font text-[1.8vmin] text-gold">CLOSED · +2.7R</span>
      </motion.div>
    </SceneShell>
  );
}

export function SceneOutro() {
  return (
    <SceneShell accent="gold">
      <Grid />
      <motion.div className="absolute left-[7%] top-[17%] right-[7%]" initial={{ scale: .92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: .2, duration: .85, ease }}>
        <div className="eyebrow mb-[3vmin] text-gold">The short version</div>
        <h2 className="display-font text-[10vmin] font-semibold leading-[.86] tracking-[-.08em]">See the<br /><span className="text-gold">signal.</span><br />Know why.</h2>
        <p className="mt-[5vmin] max-w-[76%] text-[2.4vmin] leading-[1.45] text-[#b7c1d2]">VIXUS AI builds a transparent path from market noise to a measured decision.</p>
      </motion.div>
      <motion.div className="absolute bottom-[11%] left-[7%] right-[7%] flex items-center justify-between" initial={{ y: 22, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1, duration: .6, ease }}>
        <div className="flex items-center gap-[1.8vmin]">
          <div className="flex h-[6vmin] w-[6vmin] items-center justify-center rounded-[1.4vmin] border border-gold/50 bg-gold/10">
            <span className="display-font text-[3.4vmin] font-bold text-gold">V</span>
          </div>
          <div>
            <div className="display-font text-[3.3vmin] font-semibold tracking-[-.05em]">VIXUS AI</div>
            <div className="eyebrow mt-[.5vmin] text-[#6f7d98]">market intelligence</div>
          </div>
        </div>
        <div className="mono-font text-right text-[1.5vmin] leading-[1.5] text-[#6f7d98]">ANALYZE / EXPLAIN<br />/ EXECUTE</div>
      </motion.div>
      <motion.div className="drift absolute right-[-7%] top-[49%] h-[31vmin] w-[31vmin] rounded-full border border-teal/30" initial={{ scale: .4, opacity: 0 }} animate={{ scale: 1, opacity: .65 }} transition={{ delay: .45, duration: 1.2, ease }}>
        <div className="absolute inset-[18%] rounded-full border border-gold/40" />
        <div className="absolute inset-[40%] rounded-full bg-teal/70" />
      </motion.div>
    </SceneShell>
  );
}

export function SceneBridge({ currentScene = 0 }: SceneProps) {
  return (
    <motion.div className="pointer-events-none absolute bottom-[4%] left-[7%] right-[7%] z-20" animate={{ opacity: currentScene === 0 ? .9 : .55 }} transition={{ duration: .7 }}>
      <div className="flex items-center justify-between mono-font text-[1.35vmin] tracking-[.16em] text-[#6f7d98]">
        <span>VIXUS AI</span>
        <span>{String(currentScene + 1).padStart(2, '0')} / 07</span>
      </div>
      <div className="mt-[1.4vmin] h-[.25vmin] w-full bg-[#b7c1d2]/10">
        <motion.div className="h-full bg-gold" animate={{ width: `${((currentScene + 1) / 7) * 100}%` }} transition={{ duration: .8, ease }} />
      </div>
    </motion.div>
  );
}
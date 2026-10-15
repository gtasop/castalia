// Decorative, animated illustrations in the zine style: ink outlines, small
// offset shadows, one burnt orange. Pure SVG + CSS (keyframes in
// globals.css, all named art-*), so they cost no JavaScript, follow the
// theme, and hold still for people who ask for reduced motion.

/** Deterministic "random" in [0, 1) so every render draws the same picture. */
const wobble = (i: number, seed = 1) => {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Equalizer bars standing on `baseline`, each bouncing at its own pace. */
function Bars({ x, baseline, count, gap, width, max, accentEvery }: { x: number; baseline: number; count: number; gap: number; width: number; max: number; accentEvery: number }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const h = max * (0.45 + 0.55 * wobble(i, 3));
        return (
          <rect
            key={i}
            x={x + i * gap}
            y={baseline - h}
            width={width}
            height={h}
            rx={width / 2}
            className={`art-eq ${i % accentEvery === accentEvery - 1 ? "fill-accent" : "fill-fg"}`}
            style={{ animationDuration: `${0.9 + wobble(i, 7) * 0.9}s`, animationDelay: `-${wobble(i, 11) * 2}s` }}
          />
        );
      })}
    </g>
  );
}

function Sparkle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const s = size;
  return (
    <path
      d={`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`}
      className="art-twinkle fill-accent"
      style={{ animationDelay: `${delay}s` }}
    />
  );
}

function Note({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="art-float" style={{ animationDelay: `${delay}s` }}>
        <ellipse cx="0" cy="0" rx="6.5" ry="4.8" transform="rotate(-20)" className="fill-fg" />
        <rect x="4.6" y="-24" width="2.2" height="24" rx="1" className="fill-fg" />
        <path d="M6.8 -24c7 2.5 9 7 6 13" fill="none" strokeWidth="2.4" strokeLinecap="round" className="stroke-fg" />
      </g>
    </g>
  );
}

/** A sticker slapped on at an angle, bobbing gently. */
function Sticker({ x, y, w, rotate, delay, tone, children }: { x: number; y: number; w: number; rotate: number; delay: number; tone: "accent" | "paper" | "ink"; children: string }) {
  const box = { accent: "fill-accent", paper: "fill-surface stroke-edge", ink: "fill-fg" }[tone];
  const text = { accent: "fill-accent-fg", paper: "fill-fg", ink: "fill-bg" }[tone];
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <g className="art-bob" style={{ animationDelay: `${delay}s` }}>
        <rect x="3" y="3" width={w} height="30" rx="8" style={{ fill: "var(--shadow)" }} />
        <rect width={w} height="30" rx="8" strokeWidth="1.5" className={box} />
        <text x={w / 2} y="20" textAnchor="middle" className={`font-mono text-[12px] font-bold ${text}`}>
          {children}
        </text>
      </g>
    </g>
  );
}

/** A jagged starburst: `points` spikes between radius `inner` and `outer`, a little uneven. */
const burst = (cx: number, cy: number, points: number, inner: number, outer: number) =>
  Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer * (0.9 + 0.1 * wobble(i, 5));
    const a = (Math.PI * i) / points;
    return `${(cx + r * Math.sin(a)).toFixed(1)},${(cy - r * Math.cos(a)).toFixed(1)}`;
  }).join(" ");

/** A strip of tape `w` wide with torn, zigzag ends, centred on (0, 0). */
const tornTape = (w: number, h: number) => {
  const x = w / 2;
  const y = h / 2;
  const teeth = 5;
  const step = h / teeth;
  const right = Array.from({ length: teeth }, (_, i) => `L${x + (i % 2 ? 0 : 7)} ${-y + step * (i + 0.5)}L${x} ${-y + step * (i + 1)}`).join("");
  const left = Array.from({ length: teeth }, (_, i) => `L${-x - (i % 2 ? 0 : 7)} ${y - step * (i + 0.5)}L${-x} ${y - step * (i + 1)}`).join("");
  return `M${-x} ${-y}L${x} ${-y}${right}L${-x} ${y}${left}Z`;
};

/** Home page, punk: a burned CD-R spinning on a starburst, taped and stamped. */
export function CdArt({ className = "" }: { className?: string }) {
  const cx = 200;
  const cy = 186;
  return (
    <svg viewBox="0 0 400 380" className={`art ${className}`} role="img" aria-label="A CD spinning on an orange starburst, taped with the words straight to the artists, stamped 0% cut">
      {/* Starburst, turning in hard jolts. */}
      <polygon points={burst(cx, cy, 16, 128, 176)} className="art-burst fill-accent" />

      {/* Slashes. */}
      <path d="M22 70L46 22H62L38 70ZM48 70L72 22H88L64 70ZM74 70L98 22H114L90 70Z" className="fill-fg" />

      {/* The disc: hard ink shadow, then the CD-R itself. */}
      <circle cx={cx + 9} cy={cy + 9} r="116" className="fill-fg" />
      <g className="art-spin">
        <circle cx={cx} cy={cy} r="116" strokeWidth="6" className="fill-bg stroke-fg" />
        <circle cx={cx} cy={cy} r="96" fill="none" strokeWidth="1.5" strokeDasharray="3 7" className="stroke-fg" />
        {/* Written on in marker. */}
        <text x={cx} y={cy - 54} textAnchor="middle" className="fill-fg font-mono text-[26px] font-bold tracking-tighter">
          castalia
        </text>
        <path d={`M${cx - 66} ${cy - 44}q33 -8 66 -2t66 -3`} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-accent" />
        <text x={cx} y={cy + 72} textAnchor="middle" className="fill-fg font-mono text-[13px] font-bold">
          LOUD &amp; LOSSLESS
        </text>
        <circle cx={cx} cy={cy} r="38" className="fill-fg" />
        <circle cx={cx} cy={cy} r="14" strokeWidth="3" className="fill-accent stroke-bg" />
      </g>
      {/* An orange misprint, off-register and jittering like a bad photocopy. */}
      <circle cx={cx - 7} cy={cy - 6} r="116" fill="none" strokeWidth="4" className="art-jitter stroke-accent" />

      {/* Tape slapped across it. */}
      <g transform={`translate(${cx} ${cy + 6}) rotate(-11)`}>
        <g className="art-shake">
          <path d={tornTape(300, 40)} transform="translate(6 6)" className="fill-accent" />
          <path d={tornTape(300, 40)} className="fill-fg" />
          <text y="6.5" textAnchor="middle" className="fill-bg font-mono text-[18px] font-bold tracking-tight">
            STRAIGHT TO THE ARTISTS
          </text>
        </g>
      </g>

      {/* Rubber stamp. */}
      <g transform="translate(278 330) rotate(8)">
        <g className="art-slam">
          <rect x="-76" y="-27" width="152" height="54" rx="4" strokeWidth="5" className="fill-bg stroke-fg" />
          <rect x="-68" y="-19" width="136" height="38" rx="2" fill="none" strokeWidth="1.5" className="stroke-fg" />
          <text y="11" textAnchor="middle" className="fill-fg font-mono text-[30px] font-bold tracking-tighter">
            0% CUT
          </text>
        </g>
      </g>
    </svg>
  );
}

/** A coiled headphone cord hanging from (x, y), drifting a little to the left. */
const coil = (x: number, y: number, loops: number) => `M${x} ${y}` + " c-10 2 -11 9 -1.5 11 c9.5 2 8.5 9 -1.5 11".repeat(loops);

const HAIR = [
  [150, 168, 22],
  [168, 140, 24],
  [200, 128, 27],
  [232, 140, 24],
  [250, 168, 22],
  [146, 198, 15],
  [254, 198, 15],
];

const SOUND: [string, number][] = [
  ["M100 190q-10 20 0 40", 0],
  ["M87 181q-16 29 0 58", 0.25],
  ["M300 190q10 20 0 40", 0.55],
  ["M313 181q16 29 0 58", 0.8],
];

/** Sign-up: a cartoon listener in big old-school headphones, nodding to the beat. */
export function JamArt({ className = "" }: { className?: string }) {
  const ink = { strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 400 420" className={`art ${className}`} role="img" aria-label="A cartoon listener in big old-school headphones, nodding along to the music">
      <defs>
        <pattern id="art-dots-jam" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="1.3" className="fill-line" />
        </pattern>
        <clipPath id="art-jam-clip">
          <rect x="10" y="10" width="374" height="394" rx="22" />
        </clipPath>
      </defs>

      {/* The card. */}
      <rect x="16" y="16" width="374" height="394" rx="22" style={{ fill: "var(--shadow)" }} />
      <rect x="10" y="10" width="374" height="394" rx="22" strokeWidth="1.5" className="fill-surface stroke-edge" />
      <g clipPath="url(#art-jam-clip)">
        <rect x="10" y="10" width="374" height="394" fill="url(#art-dots-jam)" />
        {[0, 1.4, 2.8].map((d, i) => (
          <circle key={d} cx="200" cy="205" r="104" fill="none" strokeWidth="1.5" className={`art-ripple ${i === 2 ? "stroke-accent" : "stroke-edge"}`} style={{ animationDelay: `${d}s` }} />
        ))}
        <Bars x={34} baseline={404} count={24} gap={14} width={8} max={70} accentEvery={5} />

        {/* The listener, swaying a little. */}
        <g className="art-sway">
          {/* Neck, then the T-shirt over it, with a V-neck and the Castalia mark. */}
          <path d="M182 258V312H218V258Z" {...ink} className="fill-surface stroke-fg" />
          <path d="M66 440C74 332 128 304 200 302C272 304 326 332 334 440Z" {...ink} className="fill-accent stroke-fg" />
          <path d="M176 304L200 332L224 304" {...ink} className="fill-surface stroke-fg" />
          <g transform="translate(236 348)">
            <path d="M12 3.5A8 8 0 1 0 12 16.5" fill="none" strokeWidth="3.5" className="stroke-accent-fg" />
            <path d="M9.5 5L17 10L9.5 15Z" className="fill-accent-fg" />
          </g>

          {/* The head, nodding to the beat; everything on it nods along. */}
          <g className="art-jam">
            <path d={coil(130, 242, 9)} fill="none" strokeWidth="2.5" strokeLinecap="round" className="stroke-fg" />
            {HAIR.map(([x, y, r]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={r} className="fill-fg" />
            ))}
            <ellipse cx="200" cy="206" rx="55" ry="61" {...ink} className="fill-surface stroke-fg" />
            <path
              d="M148 182Q154 152 176 162Q188 140 206 154Q228 140 240 164Q254 162 252 184Q240 172 226 176Q214 162 200 172Q186 162 174 176Q160 170 148 182Z"
              className="fill-fg"
            />
            {/* Eyes shut, lost in the music; brows up. */}
            <path d="M170 207q10-11 20 0M210 207q10-11 20 0" fill="none" strokeWidth="3.5" strokeLinecap="round" className="stroke-fg" />
            <path d="M169 192q10-6 20-3M211 189q10-3 20 3" fill="none" {...ink} className="stroke-fg" />
            <path d="M201 212q5 9-3 12" fill="none" strokeWidth="2.5" strokeLinecap="round" className="stroke-fg" />
            <ellipse cx="168" cy="226" rx="9" ry="5" className="fill-accent" opacity="0.35" />
            <ellipse cx="232" cy="226" rx="9" ry="5" className="fill-accent" opacity="0.35" />
            {/* Singing along. */}
            <g className="art-sing">
              <path d="M184 232Q200 256 216 232Z" {...ink} className="fill-fg stroke-fg" />
              <path d="M193 243q7 5 14 0q-7-4-14 0Z" className="fill-accent" />
            </g>

            {/* Old-school headphones: padded band, yokes, big cups with grilles. */}
            <path d="M134 196C134 96 266 96 266 196" fill="none" strokeWidth="17" strokeLinecap="round" className="stroke-fg" />
            <path d="M134 196C134 96 266 96 266 196" fill="none" strokeWidth="9" strokeLinecap="round" className="stroke-accent" />
            <rect x="126" y="164" width="9" height="18" rx="3" className="fill-fg" />
            <rect x="265" y="164" width="9" height="18" rx="3" className="fill-fg" />
            {[
              { cup: 112, pad: 144 },
              { cup: 252, pad: 244 },
            ].map(({ cup, pad }) => (
              <g key={cup}>
                <rect x={pad} y="184" width="12" height="52" rx="6" className="fill-fg" />
                <rect x={cup} y="176" width="36" height="68" rx="16" {...ink} className="fill-accent stroke-fg" />
                <path d={[196, 206, 216, 226].map((y) => `M${cup + 10} ${y}h16`).join("")} strokeWidth="2.5" strokeLinecap="round" className="stroke-accent-fg" />
              </g>
            ))}

            {/* Sound pouring out of the cups. */}
            {SOUND.map(([d, delay]) => (
              <path key={d} d={d} fill="none" strokeWidth="3" strokeLinecap="round" className="art-pulse stroke-accent" style={{ animationDelay: `${delay}s` }} />
            ))}
          </g>
        </g>
      </g>

      <Note x={84} y={122} delay={0} />
      <Note x={322} y={126} delay={1.6} />
      <Note x={338} y={278} delay={3.1} />
      <Sparkle x={66} y={262} size={8} delay={0.4} />
      <Sparkle x={300} y={74} size={7} delay={1.3} />

      <Sticker x={28} y={34} w={96} rotate={-6} delay={0.3} tone="ink">
        on repeat
      </Sticker>
      <Sticker x={280} y={30} w={92} rotate={5} delay={1.1} tone="accent">
        lossless
      </Sticker>
    </svg>
  );
}

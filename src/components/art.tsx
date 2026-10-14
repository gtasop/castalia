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

/** A point on a circle, for drawing arcs and wedges. */
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
};
const wedge = (cx: number, cy: number, r: number, from: number, to: number) =>
  `M${cx} ${cy}L${polar(cx, cy, r, from)}A${r} ${r} 0 0 1 ${polar(cx, cy, r, to)}Z`;
const arc = (cx: number, cy: number, r: number, from: number, to: number) => `M${polar(cx, cy, r, from)}A${r} ${r} 0 0 1 ${polar(cx, cy, r, to)}`;

/** Home page: a CD spinning out of its case, rippling like a spring. */
export function CdArt({ className = "" }: { className?: string }) {
  const cx = 270;
  const cy = 185;
  return (
    <svg viewBox="0 0 420 370" className={`art ${className}`} role="img" aria-label="A CD spinning out of its case, straight to the artists">
      <defs>
        <pattern id="art-dots-cd" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="1.7" className="fill-accent" />
        </pattern>
        <radialGradient id="art-cd-silver">
          <stop offset="0%" stopColor="#f8f9fb" />
          <stop offset="65%" stopColor="#d9dde3" />
          <stop offset="100%" stopColor="#adb3bc" />
        </radialGradient>
        <linearGradient id="art-cd-rainbow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff5f6d" />
          <stop offset="30%" stopColor="#ffc371" />
          <stop offset="55%" stopColor="#7cf29a" />
          <stop offset="78%" stopColor="#48c6ef" />
          <stop offset="100%" stopColor="#a07cff" />
        </linearGradient>
        <path id="art-cd-text" d={`M${cx} ${cy}m-41 0a41 41 0 1 1 82 0a41 41 0 1 1 -82 0`} />
      </defs>

      {/* Ripples spreading from the disc, like a spring. */}
      {[0, 1.5, 3].map((d, i) => (
        <circle key={d} cx={cx} cy={cy} r="132" fill="none" strokeWidth="1.5" className={`art-ripple ${i === 1 ? "stroke-accent" : "stroke-edge"}`} style={{ animationDelay: `${d}s` }} />
      ))}

      {/* The CD: silver data side with a rainbow sheen that turns with it. */}
      <g className="art-spin">
        <circle cx={cx} cy={cy} r="125" strokeWidth="1.5" fill="url(#art-cd-silver)" className="stroke-edge" />
        <path d={wedge(cx, cy, 124, -35, 15)} fill="url(#art-cd-rainbow)" opacity="0.55" />
        <path d={wedge(cx, cy, 124, 145, 195)} fill="url(#art-cd-rainbow)" opacity="0.55" />
        <path d={wedge(cx, cy, 124, 62, 82)} fill="url(#art-cd-rainbow)" opacity="0.3" />
        <path d={wedge(cx, cy, 124, 242, 262)} fill="url(#art-cd-rainbow)" opacity="0.3" />
        {[116, 98, 80, 62].map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.8" />
        ))}
        {/* Mirror band, clear hub, centre hole. */}
        <circle cx={cx} cy={cy} r="50" fill="#eef0f3" stroke="#9aa0a8" strokeWidth="0.8" />
        <text className="fill-accent font-mono text-[7px] font-bold">
          <textPath href="#art-cd-text" textLength="250" lengthAdjust="spacing">
            STRAIGHT TO THE ARTISTS · LOSSLESS ·
          </textPath>
        </text>
        <circle cx={cx} cy={cy} r="34" className="fill-bg stroke-edge" fillOpacity="0.65" strokeWidth="0.8" />
        <circle cx={cx} cy={cy} r="16" strokeWidth="1.2" className="fill-bg stroke-edge" />
      </g>
      {/* Light on the disc stays put while it turns underneath. */}
      <path d={arc(cx, cy, 106, 300, 335)} fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="5" strokeLinecap="round" />
      <path d={arc(cx, cy, 88, 120, 140)} fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />

      {/* The jewel case, with its hinge and the booklet behind the plastic. */}
      <rect x="26" y="66" width="210" height="230" rx="10" style={{ fill: "var(--shadow)" }} />
      <rect x="20" y="60" width="210" height="230" rx="10" strokeWidth="1.5" className="fill-surface stroke-edge" />
      <path d="M29 61H37V289H29Q21 289 21 281V69Q21 61 29 61Z" className="fill-line" />
      <path d="M37 61V289" strokeWidth="1.2" className="stroke-edge" />
      <path d="M26 86H32M26 264H32" strokeWidth="2" strokeLinecap="round" className="stroke-edge" />
      <rect x="50" y="74" width="166" height="92" rx="6" fill="url(#art-dots-cd)" />
      <g transform="rotate(-4 133 120)">
        <rect x="76" y="101" width="114" height="38" rx="9" className="fill-accent" />
        <text x="133" y="127" textAnchor="middle" className="fill-accent-fg font-mono text-[18px] font-bold">
          lossless
        </text>
      </g>
      <text x="50" y="196" className="fill-fg font-mono text-[22px] font-bold tracking-tighter">
        castalia
      </text>
      <text x="50" y="215" className="fill-accent font-mono text-[11px] font-bold">
        straight to the artists →
      </text>
      <Bars x={52} baseline={274} count={13} gap={12.4} width={7} max={38} accentEvery={4} />
      {/* Glare on the case's plastic. */}
      <path d="M150 61H178L96 289H68Z" style={{ fill: "var(--fg)" }} opacity="0.05" />

      <Note x={398} y={150} delay={0} />
      <Note x={384} y={238} delay={2.5} />
      <Sparkle x={250} y={28} size={9} delay={0} />
      <Sparkle x={408} y={300} size={7} delay={1.2} />
      <Sparkle x={14} y={330} size={6} delay={0.6} />

      <Sticker x={24} y={20} w={92} rotate={-5} delay={0.4} tone="paper">
        0% to us
      </Sticker>
      <Sticker x={146} y={322} w={88} rotate={4} delay={1.6} tone="ink">
        DRM-free
      </Sticker>
      <Sticker x={268} y={318} w={124} rotate={-6} delay={0.9} tone="accent">
        24-bit / 192k
      </Sticker>
    </svg>
  );
}

const TAPE = "LOSSLESS · FAIR · STRAIGHT TO THE ARTIST · 24-BIT / 192 KHZ · DRM-FREE · ";

/** Login and sign-up: the Castalia mark sending out ripples over a dancing equalizer. */
export function SignalArt({ className = "" }: { className?: string }) {
  const cx = 200;
  const cy = 205;
  return (
    <svg viewBox="0 0 400 420" className={`art ${className}`} role="img" aria-label="The Castalia mark sending out sound">
      <defs>
        <pattern id="art-dots-signal" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="1.3" className="fill-line" />
        </pattern>
        <clipPath id="art-card-clip">
          <rect x="10" y="10" width="374" height="394" rx="22" />
        </clipPath>
      </defs>

      {/* The card. */}
      <rect x="16" y="16" width="374" height="394" rx="22" style={{ fill: "var(--shadow)" }} />
      <rect x="10" y="10" width="374" height="394" rx="22" strokeWidth="1.5" className="fill-surface stroke-edge" />
      <g clipPath="url(#art-card-clip)">
        <rect x="10" y="10" width="374" height="394" fill="url(#art-dots-signal)" />

        {/* Ripples from the mark. */}
        {[0, 1.4, 2.8].map((d, i) => (
          <circle key={d} cx={cx} cy={cy} r="74" fill="none" strokeWidth="1.5" className={`art-ripple ${i === 2 ? "stroke-accent" : "stroke-edge"}`} style={{ animationDelay: `${d}s` }} />
        ))}

        {/* A strip of tape with the promises scrolling along it. */}
        <g transform="rotate(-6 200 64)">
          <rect x="-30" y="46" width="460" height="34" className="fill-accent" />
          <text x="-40" y="68" className="art-marquee fill-accent-fg font-mono text-[13px] font-bold">
            {TAPE.repeat(4)}
          </text>
        </g>

        <Bars x={34} baseline={360} count={24} gap={14} width={8} max={62} accentEvery={5} />
      </g>

      {/* The mark, big: a C opening into a play button. */}
      <g className="art-bob">
        <g transform={`translate(${cx - 50} ${cy - 50}) scale(2.1)`}>
          <rect x="7" y="7" width="38" height="38" rx="7" style={{ fill: "var(--shadow)" }} />
          <rect x="3" y="3" width="38" height="38" rx="7" strokeWidth="2" className="fill-surface stroke-edge" />
          <path d="M28 15.5A9.5 9.5 0 1 0 28 28.5" fill="none" strokeWidth="4.5" className="stroke-fg" />
          <path d="M25 16.8L34 22L25 27.2Z" className="fill-accent" />
        </g>
      </g>

      <Sparkle x={86} y={150} size={8} delay={0} />
      <Sparkle x={318} y={130} size={10} delay={0.8} />
      <Sparkle x={330} y={262} size={6} delay={1.6} />
      <Note x={90} y={262} delay={1} />
      <Note x={300} y={300} delay={3} />

      <circle cx="40" cy="388" r="4" className="art-blink fill-accent" />
      <text x="52" y="392" className="fill-muted font-mono text-[11px]">
        now playing: your next favourite album
      </text>
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

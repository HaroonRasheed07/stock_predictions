import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getArticle } from '@/lib/learn-articles';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const WIDTH = 1200;
const HEIGHT = 630;

const FALLBACK_TITLE = 'Stock Market Analysis Guides';
const FALLBACK_TAG = 'StockVantex Learn';

let logoCache: Promise<string> | null = null;

function getLogoDataUri(): Promise<string> {
  if (!logoCache) {
    logoCache = readFile(join(process.cwd(), 'public', 'logo-dark.png')).then((buffer) =>
      `data:image/png;base64,${buffer.toString('base64')}`
    );
  }
  return logoCache;
}

/** Greedy word wrap: max 3 lines, ellipsis when the title overflows. */
function wrapTitle(title: string, maxChars = 30, maxLines = 3): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  let used = 0;
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (line && next.length > maxChars) {
      lines.push(line);
      line = words[i];
      used = i + 1;
      if (lines.length === maxLines) break;
    } else {
      line = next;
      used = i + 1;
    }
  }
  if (lines.length === maxLines) {
    if (used < words.length && lines[maxLines - 1]) {
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+$/, '')}…`;
    }
    return lines;
  }
  if (line) lines.push(line);
  return lines;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const article = getArticle(slug);
  const title = article?.title ?? FALLBACK_TITLE;
  const tag = (article?.tags[0] ?? FALLBACK_TAG).toUpperCase();
  const logo = await getLogoDataUri();
  const lines = wrapTitle(title);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 72px',
          backgroundImage:
            'radial-gradient(circle at 88% 12%, rgba(59, 131, 246, 0.38), transparent 55%), linear-gradient(135deg, #0A1327 0%, #102A55 48%, #1D4ED8 100%)',
          color: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src={logo} width={276} height={46} alt="" />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px 26px',
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.12)',
              border: '2px solid rgba(255, 255, 255, 0.35)',
              color: '#DBEAFE',
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            {tag}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 1050 }}>
          {lines.map((line, index) => (
            <div
              key={`${index}-${line}`}
              style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.16, letterSpacing: -1 }}
            >
              {line}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontSize: 26,
              fontWeight: 700,
              color: 'rgba(255, 255, 255, 0.85)',
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 14,
                height: 14,
                borderRadius: 999,
                background: '#60A5FA',
              }}
            />
            stockvantex.com/learn
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255, 255, 255, 0.55)' }}>
            StockVantex
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    }
  );
}

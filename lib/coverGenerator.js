/**
 * Generates an elegant SVG book cover data URI or SVG string
 * when a vendor image is missing, dead, or blocked.
 * Designed to seamlessly blend with the bookstore's dark luxury theme.
 */

const PALETTES = {
  "African Literature": { from: "#3b1d11", to: "#120a06", accent: "#f59e0b", border: "#78350f" },
  "Fiction": { from: "#1e1b4b", to: "#09071f", accent: "#818cf8", border: "#3730a3" },
  "Non-Fiction": { from: "#0f2f2e", to: "#041414", accent: "#2dd4bf", border: "#134e4a" },
  "Business & Finance": { from: "#062e1e", to: "#02120b", accent: "#34d399", border: "#065f46" },
  "Self-Help & Mindset": { from: "#2e1065", to: "#110529", accent: "#c084fc", border: "#581c87" },
  "Children & Young Adult": { from: "#371b3e", to: "#130816", accent: "#f472b6", border: "#701a75" },
  "Biography & Memoir": { from: "#262319", to: "#0f0e0a", accent: "#fbbf24", border: "#785b14" },
  "Religion & Spirituality": { from: "#1e293b", to: "#090d14", accent: "#38bdf8", border: "#334155" },
  "Academic & Education": { from: "#1f2937", to: "#0b0f15", accent: "#94a3b8", border: "#374151" },
  "Poetry & Plays": { from: "#3f1a2e", to: "#160810", accent: "#fb7185", border: "#881337" },
  "Default": { from: "#18181b", to: "#09090b", accent: "#38bdf8", border: "#27272a" },
};

function escapeXml(unsafe) {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text, maxCharsPerLine = 18, maxLines = 4) {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  if (lines.length === maxLines && words.length > 0) {
    const last = lines[lines.length - 1];
    if (last.length > maxCharsPerLine - 3) {
      lines[lines.length - 1] = last.substring(0, maxCharsPerLine - 3) + "...";
    }
  }
  return lines;
}

export function generateBookCoverSvg({
  title = "Untitled Book",
  author = "Unknown Author",
  category = "General",
  width = 400,
  height = 560,
}) {
  const palette = PALETTES[category] || PALETTES["Default"];
  const safeTitle = escapeXml(title);
  const safeAuthor = escapeXml(author);
  const safeCategory = escapeXml(category);

  const titleLines = wrapText(title, 18, 4);
  const titleYStart = 200 - (titleLines.length * 14);

  const titleSvgLines = titleLines
    .map((line, idx) => {
      const y = titleYStart + idx * 30;
      return `<text x="200" y="${y}" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="21" fill="#f8fafc" text-anchor="middle" letter-spacing="-0.02em">${escapeXml(line)}</text>`;
    })
    .join("\n      ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 400 560">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.from}" />
      <stop offset="100%" stop-color="${palette.to}" />
    </linearGradient>
    <linearGradient id="spineHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18" />
      <stop offset="4%" stop-color="#ffffff" stop-opacity="0.08" />
      <stop offset="8%" stop-color="#000000" stop-opacity="0.4" />
      <stop offset="12%" stop-color="#ffffff" stop-opacity="0.04" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="35%" r="60%">
      <stop offset="0%" stop-color="${palette.accent}" stop-opacity="0.25" />
      <stop offset="100%" stop-color="${palette.accent}" stop-opacity="0" />
    </radialGradient>
    <pattern id="dotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="#ffffff" fill-opacity="0.04" />
    </pattern>
  </defs>

  <!-- Base Background -->
  <rect width="400" height="560" fill="url(#bgGrad)" />
  <rect width="400" height="560" fill="url(#glow)" />
  <rect width="400" height="560" fill="url(#dotGrid)" />

  <!-- Outer Border Frame -->
  <rect x="14" y="14" width="372" height="532" fill="none" stroke="${palette.border}" stroke-width="1.5" stroke-opacity="0.6" rx="6" />
  <rect x="20" y="20" width="360" height="520" fill="none" stroke="${palette.accent}" stroke-width="0.8" stroke-opacity="0.3" rx="4" />

  <!-- Category Pill Badge -->
  <g transform="translate(200, 75)">
    <rect x="-75" y="-14" width="150" height="28" rx="14" fill="#090a0f" fill-opacity="0.85" stroke="${palette.accent}" stroke-width="1" stroke-opacity="0.5" />
    <text x="0" y="4" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="10" fill="${palette.accent}" text-anchor="middle" letter-spacing="0.1em" text-transform="uppercase">${safeCategory}</text>
  </g>

  <!-- Decorative Divider Accent -->
  <line x1="140" y1="130" x2="260" y2="130" stroke="${palette.accent}" stroke-width="1.5" stroke-opacity="0.5" stroke-linecap="round" />
  <circle cx="200" cy="130" r="3" fill="${palette.accent}" />

  <!-- Book Title -->
  <g>
    ${titleSvgLines}
  </g>

  <!-- Author Divider & By Line -->
  <g transform="translate(200, 420)">
    <line x1="-40" y1="-30" x2="40" y2="-30" stroke="#475569" stroke-width="1" stroke-opacity="0.4" stroke-linecap="round" />
    <text x="0" y="-12" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="11" fill="#94a3b8" text-anchor="middle" letter-spacing="0.08em" text-transform="uppercase">BY</text>
    <text x="0" y="14" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="15" fill="#e2e8f0" text-anchor="middle" letter-spacing="-0.01em">${safeAuthor}</text>
  </g>

  <!-- Bottom Concierge Stamp -->
  <g transform="translate(200, 515)">
    <text x="0" y="0" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="9" fill="#64748b" text-anchor="middle" letter-spacing="0.15em">CONCIERGE BOOKSTORE</text>
  </g>

  <!-- Book Spine 3D Highlight Texture Overlay -->
  <rect x="0" y="0" width="40" height="560" fill="url(#spineHighlight)" />
  <line x1="28" y1="0" x2="28" y2="560" stroke="#000000" stroke-width="1" stroke-opacity="0.5" />
</svg>`;
}

export function generateBookCoverDataUrl(book) {
  const svg = generateBookCoverSvg(book || {});
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

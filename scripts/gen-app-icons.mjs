import sharp from "sharp";

const GOLD = "#d4a373";
const DARK = "#0f0d0a";
const BOLT = "M 60 6 L 16 52 L 40 52 L 32 94 L 84 44 L 56 44 Z";

const iconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="halo" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.34"/>
      <stop offset="58%" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="${DARK}"/>
  <rect width="1024" height="1024" fill="url(#halo)"/>
  <g transform="translate(192,192) scale(6.4)">
    <path d="${BOLT}" fill="${GOLD}" stroke="${DARK}" stroke-width="2"
          stroke-linejoin="round" stroke-linecap="round"/>
  </g>
</svg>`;

const splashSvg = `
<svg width="2732" height="2732" viewBox="0 0 2732 2732" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="halo2" cx="50%" cy="50%" r="40%">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.28"/>
      <stop offset="60%" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="2732" height="2732" fill="${DARK}"/>
  <rect width="2732" height="2732" fill="url(#halo2)"/>
  <g transform="translate(1166,1166) scale(4)">
    <path d="${BOLT}" fill="${GOLD}" stroke="${DARK}" stroke-width="2"
          stroke-linejoin="round" stroke-linecap="round"/>
  </g>
</svg>`;

await sharp(Buffer.from(iconSvg)).png().toFile("assets/icon.png");
await sharp(Buffer.from(iconSvg)).png().toFile("assets/icon-only.png");
await sharp(Buffer.from(splashSvg)).png().toFile("assets/splash.png");
await sharp(Buffer.from(splashSvg)).png().toFile("assets/splash-dark.png");
console.log("Generated icon (1024) + splash (2732) source images in assets/");

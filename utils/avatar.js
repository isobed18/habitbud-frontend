// Avatar system — cute generated characters + a dress-up layer.
//
// We use free avatar providers served over HTTP (no bundling):
//   - DiceBear (https://api.dicebear.com) — many cute styles; the "avataaars"
//     style supports wearable options (hats, glasses, clothing) which we expose
//     as equippable dress-up items.
//   - RoboHash kittens (set4) — fluffy animal/plushy-style characters.
//
// A user's choice is stored as a JSON string in `avatar_config`:
//   { provider, style, seed, items: [slug, ...] }
// The renderer (<Avatar/>) and AvatarStudio both read/write this shape.

const DICEBEAR = 'https://api.dicebear.com/9.x';
const BG = 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf';

// Base character styles the user can pick.
export const AVATAR_STYLES = [
  { key: 'avataaars', label: 'Karakter', provider: 'dicebear', dressable: true },
  { key: 'kitten', label: 'Kedi 🐱', provider: 'robohash' },
  { key: 'fun-emoji', label: 'Emoji', provider: 'dicebear' },
  { key: 'bottts', label: 'Robot', provider: 'dicebear' },
  { key: 'big-smile', label: 'Gülen', provider: 'dicebear' },
  { key: 'adventurer', label: 'Maceracı', provider: 'dicebear' },
  { key: 'thumbs', label: 'Minik', provider: 'dicebear' },
];

// Dress-up items (apply to the "avataaars" style via DiceBear options).
// `key` is the DiceBear option, `value` the chosen variant. Later items with
// the same key override earlier ones (one hat at a time, etc.).
export const DRESS_ITEMS = [
  { slug: 'glasses', label: 'Gözlük', emoji: '👓', key: 'accessories', value: 'prescription02' },
  { slug: 'sunglasses', label: 'Güneş Gözlüğü', emoji: '🕶️', key: 'accessories', value: 'sunglasses' },
  { slug: 'hat', label: 'Şapka', emoji: '🎩', key: 'top', value: 'hat' },
  { slug: 'winter_hat', label: 'Bere', emoji: '🧢', key: 'top', value: 'winterHat02' },
  { slug: 'hijab', label: 'Başörtü', emoji: '🧕', key: 'top', value: 'hijab' },
  { slug: 'hoodie', label: 'Kapşonlu', emoji: '🧥', key: 'clothing', value: 'hoodie' },
  { slug: 'suit', label: 'Takım', emoji: '👔', key: 'clothing', value: 'blazerAndShirt' },
  { slug: 'overall', label: 'Tulum', emoji: '👖', key: 'clothing', value: 'overall' },
  { slug: 'beard', label: 'Sakal', emoji: '🧔', key: 'facialHair', value: 'beardMedium' },
];

export const randomSeed = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

export const defaultAvatarConfig = (username = 'habitbud') => ({
  provider: 'dicebear',
  style: 'avataaars',
  seed: username || 'habitbud',
  items: [],
});

export function parseAvatarConfig(raw, username) {
  if (!raw) return null;
  try {
    const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (cfg && cfg.style) return cfg;
  } catch (_) {}
  return null;
}

export function buildAvatarUrl(config) {
  if (!config) return null;
  const seed = encodeURIComponent(config.seed || 'habitbud');

  if (config.provider === 'robohash' || config.style === 'kitten') {
    return `https://robohash.org/${seed}.png?set=set4&size=240x240`;
  }

  const style = config.style || 'avataaars';
  let url = `${DICEBEAR}/${style}/png?seed=${seed}&size=240&radius=50&backgroundColor=${BG}`;

  // Apply equipped dress-up items (avataaars only).
  if (style === 'avataaars' && Array.isArray(config.items)) {
    const opts = {};
    config.items.forEach((slug) => {
      const item = DRESS_ITEMS.find((d) => d.slug === slug);
      if (item) opts[item.key] = item.value; // last wins per key
    });
    Object.entries(opts).forEach(([k, v]) => { url += `&${k}=${encodeURIComponent(v)}`; });
  }
  return url;
}

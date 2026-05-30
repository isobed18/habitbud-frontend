# Lottie animations

Drop `.json` (or `.lottie`) animation files here, then pass them to the
`Celebration` component or any `LottieView`. Until a file is present, the app
falls back to built-in Reanimated/Animated effects — nothing breaks.

## How to use a Lottie file

```js
import Celebration from './components/Celebration';
// in a screen:
<Celebration play={counter} lottieSource={require('./assets/lottie/levelup.json')} />
```

Suggested files to add (names are conventions, not required):
- `confetti.json`   — milestone / share success burst
- `levelup.json`    — level-up celebration (can replace the emoji mascot)
- `fire.json`       — streak flame
- `success.json`    — check approved checkmark

## License-safe sources (free for commercial use)

- **LottieFiles** (https://lottiefiles.com) — filter by the *free* "Lottie Simple
  License"; download as Lottie JSON. Most "free" animations are usable in apps.
- **IconScout / Lordicon free tiers** — check each asset's license.

Always confirm the individual asset's license before shipping; some "free"
LottieFiles assets are preview-only.

## Avatars & dress-up items (future)

For the planned dress-up avatar, license-safe directions:
- **DiceBear** (https://www.dicebear.com) — free, MIT-ish avatar styles served as
  SVG/PNG via URL; great for cute generated avatars with no bundling.
- **OpenPeeps / Open Doodles / Humaaans** — CC0 hand-drawn character kits with
  swappable parts (good base for a soft, layered dress-up system).
- **Rive** (https://rive.app) — for an interactive, bone-rigged dressable
  character; export `.riv` and play with `rive-react-native`.

Backend already has an `Item` model (name, image, rarity) and `UserItem`
ownership — drop item artwork into the admin and they'll appear as challenge
rewards / inventory, ready to later render on the avatar.

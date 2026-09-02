# Studio Rack design system

Studio Rack is the hardware-studio skin for these guides: a dark control-room ground, brushed faceplate cards, 808-orange LEDs and a phosphor-green second accent. Headings are Chakra Petch — condensed, uppercase, panel-lettered. Body copy is IBM Plex Sans; labels and tags use IBM Plex Mono.

## How to use this

- Link the one stylesheet from every page — `<link rel="stylesheet" href="styles.css">` (adjust the relative path) — and take every color, font, spacing, radius and shadow from its variables (`var(--color-*)`, `var(--font-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--shadow-*)`). Never hard-code a hex, a font name or a px value the tokens already carry.
- Build with the classes below rather than inventing parallel ones.
- To change the look, edit the tokens at the top of `styles.css`. Keep this guide in step so it doesn't drift from what the CSS actually does.

## Direction

Left-aligned rack layouts. Flush-left headings set in uppercase condensed type. Lean into rectangular geometry — tight radii (`--radius-md` 4px), inset metal edges, LED focus rings. Photographs sit on the dark ground through `.washed` (slightly crushed, not bleached). Pattern charts and step grids should read as silk-screened modules, not paper cards.

## Color

A dark ground (`--color-bg` #121416) with `--color-text` #ece6d6 and two accents — `--color-accent` #f26b1d (303/808 orange) and `--color-accent-2` #8fd94a (phosphor / LCD green). Each role carries a 100–900 tonal ramp. On this theme the **neutral ramp is inverted**: 100–300 are the deep wells used by charts, pads and unused steps; 700–900 are the light silk-screen steps. Accent ramps are the same way — 100 is a dark orange or green well, 800–900 are the light LED tints used for type on those wells.

Use 100–300 for recessed fills, 500 as the role's base, and 700–900 for text on tinted fills. Prefer ramp steps over ad-hoc `color-mix()`. For elevation use `--shadow-sm/md/lg` (already tuned to the dark ground).

## Type

Chakra Petch for headings over IBM Plex Sans for body, loaded as `--font-heading` / `--font-body`. `--font-mono` (IBM Plex Mono) is for kickers, tags, field labels and table headers. Density is a 4px spacing scale; radius stays tight.

## Icons

Use Lucide icons (https://lucide.dev), at stroke-width 2 for a flatter, more instrument-panel look.

## Interaction states

Interactive states are themed, never browser defaults: give every interactive element a `:hover` tint and a pressed state from the accent ramp, and style keyboard focus with `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` plus a short orange glow. Never leave the default blue focus ring.

## Components

Same class names as before (`.btn`, `.tag`, `.card`, `.nav`, `.table`, `.dialog`, `.input`, `.seg`, `.radio`, `.hr`, `.washed`). Primary buttons are orange LED keys; inputs look like a dim LCD well; cards are rack modules with a hairline highlight on the top edge.

## Do

- Keep corners tight. Knobs stay circular; keys and cards do not.
- Use the phosphor `--color-accent-2-*` ramp for "on / armed / connected" states.
- Treat uppercase condensed labels as the display voice.

## Don't

- Do not restore pill radii (`border-radius: 999px`) on buttons, tags or inputs.
- Do not bring back the cream/sand Organic palette or Caprasimo/Figtree pairing.
- Do not use the accent orange for long body copy — use `--color-accent-700` or the text color.

## Files

- `styles.css` — the only stylesheet: tokens plus the component layer. Link it from every page.
- `readme.md` — this guide.

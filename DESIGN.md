# HeyMama design system — "Chiaro" with glass (November 2026)

The whole client follows one visual language. This file is the reference for
anyone restyling or adding a screen. The approved mockups it comes from are the
14 artboards of the "HeyMama — Redesign UI/UX" canvas.

## Principles

1. **Neutral ground, one accent.** Pages sit on `bg-gray-50` (`#F6F5F7`), content
   lives in white cards. Magenta (`#D81B72`) is reserved for the primary action,
   notification badges, active switches and "online" presence. Never use it as a
   large surface.
2. **Pink tint for selection and highlights.** Selected filters/choices and the
   one highlight card of a page use `#FCE8F1` with `#A30F55` text.
3. **Violet for places and events.** `#6D38D9` / tint `#EEE7FC` / text `#4B1FA8`.
4. **Glass for anything that floats** (bottom navigation, controls over the map
   or a photo, round header buttons, toasts).
5. **No gradients, no emoji as UI, no left-border accent cards, no drop shadows
   heavier than the tokens below.** Icons are `lucide-react`, stroke 1.9–2.
6. **Dark text always.** Body `text-gray-900`, secondary `text-gray-600`,
   captions never lighter than `text-gray-500`. White text only on magenta,
   violet or the destructive red.
7. **Touch targets ≥ 44px.** Real `<button>` / `<a>` elements; icon-only
   buttons carry an `aria-label`.

## Tokens

Tailwind's `gray`, `pink` and `purple` scales are remapped in
`tailwind.config.ts`, so use utility classes rather than hex values:

| Role | Class | Hex |
|---|---|---|
| Page ground | `bg-gray-50` / `bg-background` | `#F6F5F7` |
| Card | `bg-white` | `#FFFFFF` |
| Hairline | `border-gray-200` | `#E6E3E9` |
| Text | `text-gray-900` | `#17111F` |
| Text, secondary | `text-gray-600` | `#5C5468` |
| Text, tertiary | `text-gray-500` | `#6E657B` |
| Primary action | `bg-pink-500` / `bg-primary` | `#D81B72` |
| Accent text | `text-pink-700` | `#A30F55` |
| Selection tint | `bg-pink-50` | `#FCE8F1` |
| Places / events | `bg-purple-600`, `text-purple-700`, `bg-purple-50` | `#6D38D9`, `#4B1FA8`, `#EEE7FC` |
| Destructive | `text-destructive` / `bg-destructive` | `#B42318` |

Fonts: `font-sans` = Inter (body, labels, buttons), `font-display` = Sora
(titles, names, prices, big numbers). `h1`–`h3` use Sora automatically.

Radii: cards `rounded-3xl` (24px), highlight card `rounded-[28px]`, buttons and
inputs `rounded-2xl`, pills `rounded-full`, list thumbnails `rounded-[20px]`.

## Ready-made classes (`client/src/index.css`)

| Class | Use |
|---|---|
| `page-title` | Big title of a tab root (Sora 32px) |
| `section-label` | Small grey heading above a card or group (13px, semibold) |
| `card-float` | White content card (24px radius, soft shadow). Add padding yourself |
| `hero-card` | The one pink-tint highlight card of a page |
| `chip` + `chip-on` | Filter / choice pill, unselected and selected. `chip-lg` for the 46px size |
| `tag-pink`, `tag-violet`, `tag-neutral` | Small labels |
| `icon-btn` | 44px round glass button (back, close, more, bell) |
| `glass`, `glass-panel`, `glass-btn` | Translucent material: over map/photo, large sheets, on the flat ground |
| `ring-online` | Magenta presence ring around an avatar |
| `no-scrollbar` | Horizontal scrollers |
| `pb-nav` | Bottom padding for pages that show the floating navigation |
| `safe-page`, `safe-top`, `safe-bottom` | Device safe areas |

## Components

- **`<AppHeader>`** (`components/app-header.tsx`) is the only page header.
  - Tab root: `<AppHeader title={t("events")} left="none" right={…} />` — large
    title, no back arrow. `right` defaults to the notifications bell; pass a
    node for the page action, or `null` for nothing.
  - Pushed page: `<AppHeader title={t("settingsTitle")} right={null} />` — back
    button plus compact title.
- **Page action in the header** (create event, sell, suggest a place): a pill,
  not a floating button:
  `className="glass-btn inline-flex h-12 items-center gap-2 rounded-full pl-3.5 pr-4 text-sm font-semibold text-gray-900"`
  with a `Plus` icon. `<Fab>` remains only where a header action does not fit.
- **`<Button>`**: default = magenta. `size="lg"` (56px, Sora, soft magenta
  shadow) for the single main action of a screen or sheet. `variant="secondary"`
  = pink tint, `variant="outline"` = white with hairline, `variant="ghost"`.
  Do not pass gradient `style` props or `text-white` overrides any more.
- **`<Card>`**, `<Input>`, `<Textarea>`, `<Select>`, `<Tabs>` (pill segmented
  control), `<Switch>`, `<Dialog>`, `<Drawer>` (bottom sheet), toasts: already
  restyled centrally. Remove per-page overrides that fight them (custom
  borders, `rounded-xl`, grey backgrounds, shadows).
- **Bottom sheets** use `<Drawer>` (vaul). Dialogs are for short confirmations.
- **Avatars**: round, `object-cover`; when there is no photo show the initial
  in Sora on `bg-pink-100`. Add `ring-online` when the person is online or
  active today (`<ActivityBadge>` gives the label).
- **List rows inside a card**: `card-float px-4` wrapper, rows
  `flex items-center gap-3 py-3.5 border-b border-gray-100 last:border-0`.
- **Empty states**: no emoji. A 64px round `bg-pink-50` tile with a lucide icon
  in `text-pink-500`, a Sora title (`text-xl font-semibold`), one grey sentence,
  optionally one button.
- **Unread / counters**: `bg-pink-500 text-white` pill, 18–20px high.

## Page skeleton

```tsx
<div className="min-h-screen bg-gray-50 pb-nav">
  <AppHeader title={t("…")} left="none" />
  <main className="space-y-5 px-5">
    <section className="space-y-2.5">
      <h2 className="section-label">{t("…")}</h2>
      <div className="card-float p-4">…</div>
    </section>
  </main>
</div>
```

Pushed pages (no bottom navigation) use `pb-10` instead of `pb-nav`.

## Text

Every user-visible string goes through `t("key")`. New strings for the
redesign live in `client/src/lib/i18n/<area>.ts` (`en` and `it` objects with
the same keys); reuse existing keys from `client/src/lib/translations.ts`
whenever one already says the same thing. Option values stored in the database
stay as they are and are displayed through `optionLabel()`.

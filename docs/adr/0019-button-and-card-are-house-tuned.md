# Button and Card are house-tuned shadcn components

`components/ui/` stays as the shadcn CLI generated it, so a component can be re-added or
upgraded without merging by hand. Two files are the exception: `button.tsx` and `card.tsx`
carry the sizes and spacing of the visual redesign.

The alternative was a house wrapper around each — `AppButton`, `AppCard` — and moving 177
`<Button>` call sites onto it. A wrapper that only swaps class names buys nothing a variant
edit does not, and it leaves the shadcn component importable next to it, so the old sizes
would creep back one import at a time.

What the redesign changed, so it can be re-applied after a regeneration:

- **Button** — three heights only: `sm` 32px, `default` 36px (40px below `sm`, a tap
  target), `lg` 40px, and `icon` 32px square to sit with `sm`. Focus is a soft halo,
  `ring-2 ring-ring/50`, instead of a 1px ring. Call sites no longer force `h-6`, `h-7`
  or `h-12`.
- **Card** — `p-4` instead of `p-6` on header, content and footer; `CardTitle` is
  `text-base` by default. The app shows data, and `p-6` left cards padded like a landing
  page.

## Consequences

`npx shadcn add button` or `card` with `--overwrite` silently reverts the redesign. Re-apply
the list above after any regeneration; nothing else in the tree will flag it.

A call site that needs another height is a reason to discuss a size here, not to pass
`h-*` through `className` — that is how the six heights this replaced accumulated.

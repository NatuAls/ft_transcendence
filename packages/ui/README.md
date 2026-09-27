# HelpDesk Lite UI

`packages/ui` is the shared, framework-light design system used by `apps/web`.
Its components contain Tailwind CSS v4 utility classes and are imported from
the `ui` workspace package. `BrandMark` is a product asset and is deliberately
not counted as one of the reusable UI components.

## Foundations

The semantic tokens live in `apps/web/src/styles/global.css` under `@theme`.
Use the semantic names rather than raw values whenever one exists:

| Purpose | Tailwind token | Value |
| --- | --- | --- |
| App background | `canvas` | `#e9ece8` |
| Cards and controls | `surface` | `#f6f7f3` |
| Subtle background | `surface-secondary` | `#eff2ed` |
| Borders | `border` | `#cfd6d0` |
| Primary text | `ink` | `#1e2a2e` |
| Secondary text | `muted` | `#5e6b70` |
| Primary action | `primary` / `primary-hover` | `#365d63` / `#2e5056` |
| Feedback | `success`, `warning`, `danger`, `info` | semantic state colors |

The typeface is the system-first `font-sans` stack. The normal application
scale uses `text-xs` (supporting text), `text-sm` (controls/body), `text-base`
(body/headings), `text-xl` and `text-[30px]`/`text-[32px]` for page titles.
The shared radii are `rounded-sm` (8 px), `rounded-md` (12 px), and
`rounded-lg` (16 px).

## Component catalog

There are 16 component exports, of which 15 are generic reusable components:

| Component | Main API / variants | Used for |
| --- | --- | --- |
| `Alert` | `info`, `success`, `warning`, `danger` | Inline status and errors |
| `Avatar` | image or initials, optional online state | People and account identity |
| `Button` | `primary`, `secondary`, `ghost`, `destructive`; full width | All actions |
| `Checkbox` | accessible label and native input props | Auth and permissions |
| `Dialog` | title, description, footer, initial focus | Modal forms and confirmations |
| `DropdownMenu` | labelled menu container | Account menu |
| `EmptyState` | title, description, optional action | Empty lists/searches |
| `Icon` | typed `IconName`, optional accessible label | Consistent SVG iconography |
| `IconButton` | typed icon, required label, `sm`/`md` | Compact actions |
| `LoadingState` | optional label | Async message history |
| `Pagination` | controlled page and total | Ticket list |
| `SelectField` | label, hidden-label option, native select props | Forms and filters |
| `StatusBadge` | `open`, `progress`, `resolved`, `urgent`, `closed` | Ticket state |
| `Tabs` | controlled typed tab items | Account and organization sections |
| `TextField` | label, error, native input props | Forms |

`BrandMark` is also exported for product branding, but it is not a generic
component and does not count toward the design-system requirement.

## Usage

```tsx
import { Alert, Button, Dialog, TextField } from 'ui';

<TextField label="Workspace name" name="name" required />;
<Alert tone="success">Workspace saved.</Alert>;
<Button variant="secondary">Cancel</Button>;
```

Prefer component props over overriding internals. A caller may pass
`className` for layout or a one-off responsive size, but it should not recreate
a component's colors, focus treatment, disabled state, or typography.

## Accessibility and interaction

- Every form control has a visible label or an explicit accessible label.
- `IconButton` requires `label`; decorative `Icon` instances are hidden from
  assistive technology by default.
- `Dialog` moves focus inside, traps `Tab`, closes on `Escape`/backdrop, locks
  body scrolling, and restores the previous focus.
- `DropdownMenu` consumers provide menu-item roles and keyboard navigation.
- Focus rings are global and high-contrast. Color never carries status alone.
- Motion is effectively disabled when `prefers-reduced-motion` is enabled.
- Native controls remain native so keyboard and mobile behavior are retained.

## Adding or changing a component

1. Add a focused component under `packages/ui/src` and export it from
   `src/index.ts`.
2. Build variants from semantic tokens; do not duplicate page-specific data or
   business logic in this package.
3. Cover hover, focus-visible, disabled, error, and responsive behavior where
   relevant.
4. Use it in at least one real screen. Do not add wrapper-only components to
   inflate the catalog.
5. Run `npm run lint --workspace=packages/ui`,
   `npm run typecheck --workspace=packages/ui`, and the web build.

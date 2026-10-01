# Frontend development guide

The web application uses React 19, TypeScript, Vite 8 and Tailwind CSS v4.
The current rendered application is the visual reference. Shared controls live
in `packages/ui`; API contracts remain in `packages/contracts`.

## Structure

- `src/app`: hash router, route parsing, session boundary, error and 404 views.
- `src/layout`: authenticated shell, profile menu and global search.
- `src/features/<area>`: page components and area-specific data/API adapters.
- `src/api`: authentication and user API clients.
- `src/styles/global.css`: Tailwind import, source registration, semantic theme,
  the browser reset/focus baseline and reduced-motion rule.
- `packages/ui`: reusable presentation and interaction components. See
  [`../../packages/ui/README.md`](../../packages/ui/README.md).

Page files own orchestration and feature state. Repeated controls, interaction
patterns and generic visual states belong in `packages/ui`. Network calls and
domain mapping stay in an API/data module rather than a visual component.

## Create a page or feature

1. Create the feature folder and its page component under `src/features`.
2. Add a typed route to `src/app/routes.ts` and render it in
   `src/app/WorkspacePage.tsx`.
3. Reuse `Button`, `TextField`, `SelectField`, `Dialog`, `Tabs`, `Alert`,
   `EmptyState`, and the other shared components before adding a new primitive.
4. Build layout with Tailwind utilities in the component. Use semantic theme
   tokens (`bg-surface`, `text-ink`, `border-border`) instead of hard-coded
   values when a token exists.
5. Implement desktop and mobile behavior together. Existing screens generally
   switch at `767px` (`max-md`) and the application shell switches at 1100px.
6. Represent loading, empty, error, success, disabled and focus states. Keep
   native form semantics and keyboard behavior.
7. Add the API call through the feature adapter or `src/api`; do not encode
   server behavior in presentation components.
8. Run lint, typecheck, build and the relevant interaction/viewport checks.

## Tailwind and CSS policy

Tailwind v4 is integrated through `@tailwindcss/vite`; there is no
`tailwind.config.js`. Theme tokens are declared with `@theme` and the shared UI
workspace is registered with `@source` in `src/styles/global.css`.

Feature-level CSS files are intentionally absent. Plain CSS is allowed only in
`global.css` when it is materially clearer or required for:

- Tailwind/theme registration and semantic tokens;
- document reset and global focus behavior;
- reduced-motion behavior;
- a truly global font, native-control, pseudoelement or keyframe case that
  utilities cannot express clearly.

Before adding CSS, check arbitrary values/variants and whether the pattern
belongs in a reusable UI component. Do not add a second token system or copy a
long utility string across pages.

## Responsive and state conventions

- Start with the desktop reference where the page is information-dense, then
  explicitly define the `max-md` experience; never rely on accidental wrapping.
- Fixed mobile navigation occupies 74 px. Sticky page actions must account for
  it and remain keyboard reachable.
- Dialog content scrolls inside a bounded surface; the whole form should not
  create horizontal scrolling.
- Use `focus-visible`, not focus removal. Keep `aria-current`, `aria-expanded`,
  `aria-live` and dialog/menu roles when the interaction calls for them.
- Prefer controlled components for filters/tabs/pagination so route state and
  backend data can replace preview data without a visual rewrite.

## Backend integration boundary

Some screens still use local preview arrays while the real backend endpoints
are completed. Replace those arrays through their feature data adapters; do not
rewrite the page markup. Authentication, account/profile preferences and chat
already exercise API-facing modules. The authoritative endpoint mapping and
remaining integration work are documented in
[`INTEGRATION.md`](INTEGRATION.md).

## Quality commands

From the repository root:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test --workspaces --if-present
```

For visual changes, compare the same route, data and interaction state at
1440×900, 1024×768 and 390×844. Check the browser console, keyboard focus,
menus, dialogs, filters, forms and mobile fixed navigation.


# Workeasy Design System

## 1. Product Character

Workeasy is an operational scheduling tool for store managers and staff. Interfaces should feel calm, direct, and information-dense. Settings pages prioritize repeat use, scanning, and reliable editing over promotional presentation.

Design dials:

- Design variance: 3/10
- Motion intensity: 2/10
- Information density: 7/10

## 2. Foundations

- Use the existing semantic CSS variables from `src/app/globals.css` for background, foreground, border, muted, primary, destructive, and focus-ring colors.
- Keep the neutral gray foundation. Use blue for schedule information and selection, amber for warnings, red for destructive states, and green only for confirmed success.
- Use the existing font stack and normal letter spacing. Do not scale font size from viewport width.
- Use the existing 8px maximum corner radius. Operational sections remain unframed; cards are reserved for distinct settings groups or repeated records.

## 3. Layout

- Constrain store settings content to the existing `max-w-5xl` page frame.
- Use a 4px base spacing rhythm through Tailwind utilities (`gap-1`, `gap-2`, `gap-4`, `gap-6`, `gap-8`).
- Keep primary settings controls in a single vertical reading order on mobile.
- Allow horizontal scrolling only on the existing top-level tab list. Editors own their vertical growth and must not create nested scroll panes.
- Use stable grid tracks for weekday controls, time fields, role choices, and numeric inputs so validation text cannot shift neighboring controls.

## 4. Typography

- Page title: existing `text-3xl font-bold` treatment.
- Settings section title: `text-lg font-semibold` or the existing `CardTitle` style.
- Record title: `text-sm font-medium` to `text-base font-semibold` depending on density.
- Supporting text and validation: `text-sm`; compact metadata may use `text-xs`.
- Keep labels explicit and adjacent to their controls. Do not use placeholder text as the only label.

## 5. Components

- Use shared components from `src/components/ui` before creating new primitives.
- Use `Button` with Lucide icons for add, delete, reorder, expand, and save commands. Icon-only buttons require a localized accessible label and tooltip when the symbol is unfamiliar.
- Use `Input` for names, times, and numeric values; `Checkbox` for weekdays and required roles; `Switch` for activation; `Tabs` for major store-setting domains.
- Use `Card` only for a single operating-pattern record or an existing settings group. Do not nest cards.
- An operating-pattern editor contains a compact header, weekday selector, and a flat list of segment rows. Segment rows use bordered dividers or a quiet muted background, not nested cards.

## 6. Interaction

- Preserve edits locally until the user invokes the existing settings save command.
- Destructive record removal uses a clear icon and localized accessible label. Confirmation is required only when data is already persisted or deletion has broad impact.
- Validation errors block save and appear near the affected pattern. Non-blocking warnings, such as a segment without required roles or a gap between segments, use amber styling.
- Keep motion to short component transitions already supplied by Radix. Do not add decorative entrance animation.

## 7. Responsive Behavior

- At 375px, pattern headers and actions may wrap, weekday controls remain tappable, and each segment becomes a vertical field stack.
- At 768px, segment inputs may use a two-column layout while role selection spans the available width.
- At 1280px, time, headcount, and actions align in one compact row where content permits.
- Text must wrap within controls and status areas. Fixed-format controls use explicit heights or grid constraints to prevent layout shift.

## 8. Accessibility And Content

- All user-facing text comes from the `ko`, `en`, and `ja` locale dictionaries.
- Every input has a visible label or an accessible name. Error and warning text must not rely on color alone.
- Preserve keyboard access and visible focus rings from the shared Radix components.
- Use store terminology consistently: operating pattern, applicable weekdays, segment, minimum headcount, and required roles.

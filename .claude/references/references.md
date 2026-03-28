# UI Reference Guide

These screenshots are visual targets for the Roadrunner UI overhaul. Don't copy them literally — learn the principles they demonstrate and apply them to Roadrunner's specific needs.

## How to Use These References

Before starting each task, view the relevant reference screenshots (use `view` to see the images). Study what makes them feel professional, then apply those principles to the page you're building. After implementing, screenshot your own work and compare side-by-side.

## Reference Screenshots

### github_item_list.png
**What to learn:** List density and row structure. Notice how each row has a consistent height, clear hierarchy (title prominent, metadata secondary), and status indicators that are visible without dominating. The spacing between items is tight but readable. Filter/sort controls sit inline above the list, not in a separate panel. Apply this to: Partner list, Tasks page, Meetings list, any list view.

### linear_sidebar_and_cards.png
**What to learn:** Sidebar hierarchy and card layout. Notice how the sidebar uses weight and indentation — not color — to show hierarchy. Active state is subtle but unambiguous. Cards have clear boundaries without heavy borders. Content sections are visually separated by spacing, not by lines or boxes everywhere. Apply to: Sidebar redesign, Today screen sections, Partner detail page sections.

### vercel_dashboard.png
**What to learn:** Dashboard density and professional feel. Notice the balance between information density and whitespace. Data is presented without decoration — no unnecessary icons, no color for color's sake. The layout breathes without wasting space. Headers are minimal. Actions are discoverable but not shouting. Apply to: Today screen, Partner detail financial snapshot, any data-heavy view.

### raycast_sleekness.png
**What to learn:** Dark theme polish and minimalism. Notice how the dark background feels intentional, not like a light theme with colors inverted. Surfaces have subtle elevation differences. Text contrast is carefully calibrated — primary text is bright, secondary text is distinctly muted, not just slightly dimmer. Interactive elements have clear affordances. Apply to: Overall dark theme treatment, button styling, input fields, modal dialogs.

### github_home_page.png
**What to learn:** Content cards and visual hierarchy. Notice how different content types (repos, activity, suggestions) each have distinct visual treatments but feel cohesive. The page guides your eye from top to bottom with clear section breaks. Apply to: Today screen layout where different content types (meetings, tasks, inbox signal) need to coexist.

### windsurf_sleekness.png
**What to learn:** Navigation structure and content organization. Notice the three-column layout: nav sidebar, content area, contextual sidebar. The sidebar sections are clearly grouped with subtle headers. Active states are prominent. The content area has good typography hierarchy — headings, body text, and cards each have distinct visual weight. Apply to: Partner detail page layout, meeting detail page layout, any page with both navigation and content.

### ui-ux-best-practices.md
**What this is:** A comprehensive guide to enterprise-grade interaction patterns — button states, loading indicators, error handling, destructive action safety, navigation guards, dark theme rules, typography, spacing, forms, and feedback timing. These are concrete rules, not inspiration.
**When to read it:** Before any UI work. Reference specific sections when implementing buttons, loading states, error handling, forms, or any interactive behavior.
**Key sections:** Button States (7 states every button needs), Loading States (matched to duration), Destructive Actions & Undo (soft delete, undo patterns), Navigation Safety (unsaved changes), Dark Theme Patterns, Spacing & Layout (4px scale rules), Confirmation & Feedback (every action gets feedback), Interaction Feedback Timing (response time thresholds).

## Universal Principles Across All References

These patterns appear in every reference and should be applied everywhere in Roadrunner:

1. **Spacing is consistent and deliberate.** No random gaps. Everything aligns to a grid.
2. **Typography does the heavy lifting.** Size and weight create hierarchy, not color or decoration.
3. **Dark themes use surface elevation.** Background → surface → elevated surface. Subtle but consistent.
4. **Interactive elements are obvious.** You never wonder "can I click this?" Hover states confirm it.
5. **Information density is earned.** Dense pages work because every element has a purpose. Remove anything that doesn't earn its space.
6. **White space is a feature.** The space between elements is as intentional as the elements themselves.
7. **Status is communicated through badges, not just color.** Color-blind users can still read the UI.
8. **Actions are verbs.** Buttons say what they do. "Generate Summary" not "Go". "Route to Engagement" not "Submit".

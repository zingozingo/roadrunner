# Enterprise UI/UX Best Practices

Actionable rules for building professional, enterprise-grade interfaces. Every pattern here is battle-tested across products like Linear, Vercel, GitHub, Notion, and Stripe. Apply these to every page, every component, every interaction.

---

## 1. Button States

Every button must have these states. No exceptions.

**Default:** High contrast, clearly clickable. Primary buttons use accent color fill. Secondary buttons use border/outline. Tertiary buttons are text-only.

**Hover:** Subtle color shift (lighten or darken by 10-15%). Transition: 150ms ease. Never make drastic changes — the shift should confirm "yes, this is clickable" without being jarring.

**Active/Pressed:** Slightly darker than hover, or scale down to 98%. Feedback must appear within 100ms so the user knows their click registered.

**Disabled:** Reduced opacity (0.4-0.5). Remove pointer cursor. Never hide disabled buttons — show them disabled so users know the action exists but isn't available yet. Pair with a tooltip explaining why it's disabled when possible.

**Loading:** Replace button text with a spinner OR show spinner alongside text ("Generating..."). Button must be disabled during loading — no double-clicks. Never let a loading button return to default state without either success or error feedback.

**Success:** Brief confirmation (checkmark icon, green flash, or text change to "Saved!"). Display for 1.5-2 seconds, then return to default. The user must see confirmation that their action worked.

**Button labels are verbs.** "Generate Summary" not "Go." "Save & Lock" not "Submit." "Route to Engagement" not "Assign." "Delete Partner" not "Remove." The label tells you exactly what happens when you click.

**Button hierarchy on any screen:** One primary action (filled, prominent), zero or one secondary action (outlined or muted), and any number of tertiary actions (text-only, subtle). Never put two primary-styled buttons next to each other.

---

## 2. Loading States

Match the loading indicator to the expected duration:

**Instant (<200ms):** No indicator needed. The UI just updates. Adding a spinner that flashes and disappears is worse than no spinner.

**Short (200ms-1s):** Inline spinner on the triggering element (e.g., inside the button, or a small spinner replacing an icon). No overlay, no modal.

**Medium (1-5s):** Contextual loading state with a message. "Generating summary..." or "Syncing catalogs..." The message tells the user what's happening, not just that something is happening. Disable the triggering element.

**Long (5s+):** Progress bar or step indicator. If you can't show real progress, show an indeterminate progress bar with a descriptive message. Consider allowing the user to navigate away and come back.

**Skeleton screens vs. spinners:** Use skeleton screens (gray placeholder shapes) for initial page loads where you know the layout. Use spinners for actions triggered by the user (button clicks, form submissions). Never use skeleton screens that flash for <200ms — if data loads fast, just show the content.

**The golden rule:** The user should never stare at a screen wondering "is it loading or is it broken?" Every loading state must be visually distinct from the loaded state AND from the error state.

---

## 3. Error States & Recovery

**Inline, not modal.** Show errors next to the element that caused them. A form field error appears below the field, not in an alert box. A failed API call shows an inline error banner on the page, not a browser alert.

**Say what went wrong AND what to do about it.** Bad: "An error occurred." Good: "Failed to generate summary — try again." Best: "Failed to generate summary — try again" with a retry button right there.

**Don't clear the user's work on error.** If form submission fails, keep all the data in the form. If note summarization fails, keep the raw notes visible. The error is the system's problem, not the user's — don't punish them by erasing their input.

**Network errors are not crashes.** If an API call fails, show an inline error state on that section of the page. Don't let the entire page break. Other sections that loaded successfully should remain visible and functional.

**Retry must be one click.** If an operation failed, the user should be able to retry from the exact same state without re-entering data or re-navigating. A "Try Again" button that replays the failed operation.

---

## 4. Destructive Actions & Undo

**Confirmation before destruction.** Delete, discard, and permanent-state-change actions require a confirmation dialog. The dialog must name what's being destroyed: "Delete task: Submit Orange Logic for MDF wallet reload?" not just "Are you sure?"

**Soft delete over hard delete when possible.** Completed tasks should show as struck through for a period before disappearing, not vanish instantly. This gives the user a chance to realize they checked the wrong item. The same applies to discarding inbox items — show them grayed out briefly before removal.

**Undo is better than confirm.** Where feasible, skip the confirmation dialog and instead show a toast with an undo option: "Task completed — Undo". This is faster for the user (no dialog interruption) and safer (they can reverse it within 5-10 seconds). Gmail's undo-send is the gold standard of this pattern.

**Color-code destructive buttons.** Delete buttons are red or have a red accent. They should never look like primary action buttons. Position them away from the primary action to prevent misclicks — typically far right or in a separate "danger zone."

---

## 5. Navigation Safety

**Warn before data loss.** If the user has unsaved changes (meeting notes in progress, form edits, scratchpad changes), intercept navigation with a confirmation dialog: "You have unsaved changes. Leave anyway?"

**Implementation:** Use both `beforeunload` (catches browser back, tab close, URL change) and framework-level route interception (catches in-app navigation). Both are needed — one alone leaves gaps.

**Auto-save where appropriate.** For scratchpad/notepad content, auto-save on a debounce (save 1 second after the user stops typing). Show a subtle "Saved" indicator. This eliminates the navigation safety problem for that content entirely.

**Never lose meeting notes.** Meeting notes are the #1 interaction. If the user has written notes and navigates away, those notes must either be saved automatically or the user must be warned. Silent data loss here is a trust-destroying failure.

---

## 6. Empty States

**Empty is not blank.** An empty section should communicate what belongs there and ideally how to get started. "No tasks yet — tasks are extracted from meeting notes or created manually." Not just a blank white space.

**Collapse gracefully.** On aggregate pages (like Today), sections with no content should collapse entirely rather than showing empty state messages that waste space. If there are no meetings today, the tasks section should be the first thing visible — not an empty "No meetings today" card pushing content down.

**Empty vs. loading vs. error must be visually distinct.** The user should never confuse "this section has no data" with "this section is still loading" or "this section failed to load." Use different visual treatments for each: skeleton for loading, icon+message for empty, red banner for error.

---

## 7. Lists & Data Density

**Consistent row heights.** Every row in a list should be the same height. Variable row heights create visual chaos and make scanning harder. If some items have more content, truncate with ellipsis and expand on click.

**Visual rhythm matters.** Spacing between items, spacing within items, and padding must follow the spacing scale consistently. A list of 22 partners should feel like a cohesive unit, not 22 independent boxes stacked up.

**Group with purpose.** Grouping should answer a question. "Partners by segment" answers "what kind of partner is this?" "Tasks by partner" answers "what do I owe Spacelift?" Don't group just for visual variety — every grouping must serve the user's mental model.

**Scannable at a glance.** The user should be able to scan a list of 20+ items and identify the one they want within 2-3 seconds. This means: strong title typography, muted metadata, visual indicators (badges, colors) that differentiate items without requiring reading.

**Truncation with access.** Long text gets truncated with an ellipsis. But the full text must be accessible — via tooltip on hover, or expansion on click. Never truncate without providing a way to see the full content.

---

## 8. Dark Theme Patterns

**Surface elevation creates depth.** Background → surface → elevated surface. Each level is slightly lighter (not dramatically — 3-5% lightness increase per level). This creates visual hierarchy without borders everywhere.

**Desaturate colors.** Colors that look great on white backgrounds look garish on dark backgrounds. Reduce saturation by 20-30% for dark themes. Your accent indigo (#6366f1) should feel integrated, not like a neon sign.

**Text contrast hierarchy:** Primary text at 87-90% white opacity. Secondary text at 60% white opacity. Disabled/placeholder text at 38% white opacity. This creates clear readable hierarchy. Never use pure white (#ffffff) for body text on dark backgrounds — it's too harsh. Use off-white like #e4e4e7.

**Borders are subtle.** Dark theme borders should be barely visible — enough to delineate sections, not enough to create a grid of boxes. Use 8-12% white opacity for borders, or a very dark color like #2a2b35.

**Never invert a light design.** Dark themes aren't light themes with the colors swapped. They require their own design decisions about elevation, emphasis, and contrast. Shadows don't work in dark themes — use lighter surfaces and subtle borders instead.

**Status colors need adjustment.** Green/red/amber status colors must be tested specifically against dark backgrounds. They often need lightening or desaturation to be readable without being overwhelming.

---

## 9. Typography & Hierarchy

**Three levels maximum per page.** Page title (large, bold), section headers (medium, semibold), body text (normal). If you need more levels, your information architecture is wrong — restructure, don't add a 4th heading size.

**Size and weight do the work, not color.** Hierarchy is established through size differences (16px body, 20px section, 28px title) and weight (400 regular, 500 medium, 600 semibold). Don't use color to differentiate hierarchy levels — save color for semantics (links, status, errors).

**Monospace for data.** Financial numbers, IDs, dates, and technical values should use a monospace font. This ensures columnar alignment and gives data a distinct visual identity from prose.

**Line height for readability.** Body text: 1.5-1.6 line height. Dense data/lists: 1.3-1.4. Headings: 1.1-1.2. These aren't arbitrary — they're the spacing that makes text comfortable to read at each size.

**Labels are uppercase, small, and muted.** Section labels like "PARTNER" or "STATUS" or "PILLAR" use: text-xs, font-semibold, uppercase, tracking-wider, text-muted. This treatment is universal — use it everywhere labels appear.

---

## 10. Spacing & Layout

**The 4px scale is sacred.** All spacing: 4, 8, 12, 16, 24, 32, 48, 64. No other values. If a gap looks "slightly off," it's because you used a value off the scale. Fix it — don't eyeball it.

**Consistent padding within containers.** Cards/panels: 16px or 24px padding. List items: 12px or 16px vertical padding. Page margins: 24px or 32px. Pick one value per container type and use it everywhere.

**Spacing between related items is less than spacing between unrelated items.** Items within a group: 8-12px. Groups within a section: 16-24px. Sections within a page: 32-48px. This creates visual clustering that communicates relationships without lines or borders.

**Content width.** Main content should have a max-width (typically 1024-1280px on wide monitors) to prevent text lines from becoming unreadably long. Centered with auto margins. Sidebar is fixed width (typically 240-280px).

**No orphaned whitespace.** Every gap between elements should be intentional and on the spacing scale. Random gaps where elements don't quite align are the hallmark of amateur UI.

---

## 11. Forms & Inputs

**Labels above inputs, always.** Left-aligned labels above the input field. Never floating labels that animate into the border — they cause accessibility issues and confuse users about whether the field is filled or empty.

**Validation on blur, not on keystroke.** Validate a field when the user tabs/clicks away from it, not while they're still typing. Real-time validation that shows "Invalid email" after typing one character is hostile.

**Error messages below the field.** Red text, small font, directly below the field that has the error. Pair with a red border on the field itself. Don't clear the field — keep the user's input so they can fix it.

**Disabled fields show value.** If a field is disabled (read-only), it should still display its current value clearly. Don't gray it out so much that the value becomes unreadable.

**Submit button state reflects form state.** Button is disabled until all required fields are valid. Button shows loading state during submission. Button shows success or error after submission completes.

---

## 12. Confirmation & Feedback

**Every action gets feedback.** Click a button → something visible changes. Complete a task → checkmark appears. Save notes → "Saved" indicator. Route an email → item moves/disappears with animation. No action should ever feel like clicking into the void.

**Toast notifications for non-destructive confirmations.** "Task completed" or "Note saved" — brief toast in the corner, auto-dismiss after 3-4 seconds. The user doesn't need to do anything with this information, just see it.

**Don't auto-dismiss important information.** Error messages and warnings should stay visible until the user dismisses them. A toast that says "Failed to save" and disappears after 3 seconds is worse than no feedback at all.

**Transitions communicate change.** When an item is removed from a list, the remaining items should animate closed — not jump. When a section expands, it should animate open — not pop. Transitions should be fast (150-250ms) but present. Instant state changes feel broken.

---

## 13. Interaction Feedback Timing

**0-100ms:** Feels instant. Use for: button press visual feedback, checkbox toggle, dropdown open.

**100-300ms:** Feels responsive. Use for: transitions, animations, expanding/collapsing sections.

**300ms-1s:** Feels like something is happening. Use for: brief API calls. Show subtle loading indicator if >500ms.

**1-5s:** Feels like waiting. Use for: AI operations, complex queries. Must show loading state with descriptive message.

**5s+:** Feels slow. Use for: batch operations, file uploads. Must show progress indicator. Consider allowing background operation.

**The rule:** If an operation takes longer than 300ms, show feedback. If it takes longer than 1 second, tell the user what's happening. If it takes longer than 5 seconds, show progress.
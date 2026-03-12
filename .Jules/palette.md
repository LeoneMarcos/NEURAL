## 2026-03-12 - Contextual Links and Focus-Within Cards
**Learning:** Screen readers reading out "Read more" repeatedly across cards is a poor experience. Additionally, using focus-visible on the link combined with focus-within on the parent card provides excellent keyboard navigation feedback without adding custom JS or CSS.
**Action:** Always add context-rich aria-labels to generic "Read more" or "Learn more" links. Use the Tailwind `focus-within` pseudo-class on parent containers to highlight the entire card when a child element receives keyboard focus.

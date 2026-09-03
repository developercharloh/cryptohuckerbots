---
name: VIXUS legal document imports
description: Handling pasted legal documents that contain invisible formatting characters and meaningful whitespace.
---

When importing a pasted legal document into the User App, preserve its visible wording, section order, blank lines, and meaningful trailing spaces in the rendered output, but remove invisible direction-control marks that can be introduced by copy/paste.

**Why:** The uploaded Terms document contained a left-to-right mark at the start of every line. Keeping those hidden characters adds noise without changing what users see, while normalizing meaningful whitespace can make an “exact” legal-document replacement subtly different.

**How to apply:** Compare the evaluated rendered string with the source after removing only known invisible direction marks; keep an explicit source representation that passes whitespace checks and verify the production lazy-loaded legal chunk after publishing.
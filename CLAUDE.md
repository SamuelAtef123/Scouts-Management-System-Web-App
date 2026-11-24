# Project instructions

## Commits
- Never mention Claude, AI or any assistant in commit messages, and add no "Co-Authored-By" or similar attribution lines.
- Commit as the repository owner (git user.name "Samuel Atef").

## Keep the report and presentation up to date
Whenever a feature is added, changed or removed (or a permission rule changes), in the same piece of work:
1. Update `docs/source/report/report.html` (PDF report and user guide) and `docs/source/deck/build.js` (PowerPoint) so they describe the app as it now is. Replace screenshots in `docs/source/report/` if a screen they show changed.
2. Rebuild both: `cd docs/source && npm install && npm run build` (see `docs/source/README.md`).
3. Check the rendered pages and slides for overflow, then commit the updated `docs/Scouts-Project-Report-and-User-Guide.pdf` and `docs/Scouts-Project-Presentation.pptx` with the change.
4. Also update `README.md` where the change affects setup, roles or the API.

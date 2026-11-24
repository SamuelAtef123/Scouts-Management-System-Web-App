# Project report and presentation sources

These files build the two documents in `docs/`:

| Output | Source |
| --- | --- |
| `docs/Scouts-Project-Report-and-User-Guide.pdf` | `report/report.html` (A4, printed with Chromium) |
| `docs/Scouts-Project-Presentation.pptx` | `deck/build.js` (pptxgenjs) |

**Keep them up to date:** whenever a feature is added or changed in the app, update both sources (and the screenshots in `report/` if a screen changed), rebuild, and commit the new PDF and PPTX together with the code change.

## Rebuild

```bash
cd docs/source
npm install
npm run build
```

- The PDF step needs Playwright with Chromium (`npm install -g playwright && npx playwright install chromium`).
- `report/` holds the logo, the group photo, app screenshots (390 × 844 phone size) and `lucide.min.js` for the icons.
- The deck reuses the images in `report/`.
- Optional: set `APPLY_THEME` to the path of the pptx skill's `apply_theme.js` to write the logo colours into the PowerPoint theme.

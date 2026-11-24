# SIQA chart refresh

The chart lists live in JSON:

- `data/siqa-chart.json` for `/charts` and `/charts/top-100`
- `data/siqa-rnb.json` for `/charts/rnb`
- `data/siqa-country.json` for `/charts/country`
- `data/siqa-gospel.json` for `/charts/gospel`

Each file has `week`, `official`, `category`, and `tracks` (`rank`, `title`, `artist`, and a `youtubeId` only when that same song already had one). The visible week line is in the matching HTML file, as `Week of <date>`.

## Weekly job

`.github/workflows/siqa-charts.yml` runs every Tuesday at 20:30 UTC (about 12:30 PM Pacific Standard Time). It fetches https://www.thesiqa.com/charts and opens a pull request. It does not merge.

The page is server-rendered Webflow HTML, so a normal fetch returns the four lists. The script writes a chart only when that list has every rank, with a title and artist on each row. A missing or short list is left as it was.

Run the same step locally:

```
npm run charts:refresh
```

No API key is required, and none is sent to the browser.

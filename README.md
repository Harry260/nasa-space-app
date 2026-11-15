# FireScope

Real-time wildfire tracker powered by NASA FIRMS (MODIS and VIIRS NOAA-20 satellite feeds).

Live: https://nasa-firescope.vercel.app

## Features

- Fullscreen map powered by MapLibre GL with flat 2D projection and interactive 3D globe.
- Basemaps: Normal (OpenStreetMap), Satellite (Esri World Imagery), and High-Contrast Dark.
- Theme switching: light theme on normal map, dark theme on satellite and dark basemaps.
- MODIS (1 km) and VIIRS (375 m) fire pixel layers with radiative power (FRP) and confidence metrics.
- Cross-sensor spatial overlap analysis (1 km proximity validation).
- Searchable region picker with auto-detected default region and recent search history.
- Daily fire detection trends with customizable lookback windows (1–5 days).
- Works with zero map API keys (OpenStreetMap + Esri public tiles). Only needs a free NASA FIRMS MAP_KEY.

## Setup

1. Grab a free MAP_KEY from [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/map_key/).
2. Create `.env`:
   ```bash
   cp .env.example .env
   # Add your key: FIRMS_MAP_KEY=your_key_here
   ```
3. Install and run:
   ```bash
   npm install
   npm run dev
   ```

## Deploying to Vercel

### Option 1: Vercel CLI
```bash
vercel
```
When prompted for project name, enter `nasa-firescope`.

Add your NASA FIRMS key:
```bash
vercel env add FIRMS_MAP_KEY
vercel --prod
```

### Option 2: Vercel Dashboard
1. Push this repo to GitHub / GitLab.
2. Import the project in Vercel with project name `nasa-firescope`.
3. In **Settings > Environment Variables**, add:
   - `FIRMS_MAP_KEY` = your 32-character NASA key.
4. Deploy.

The Vercel serverless proxy in `api/firms.js` forwards requests to NASA and caches responses for 2 minutes to protect your API quota.

## Tech Stack

- **Frontend**: React 18, Vite, MapLibre GL, Recharts, Papaparse, GradualBlur
- **Basemaps**: OpenStreetMap, Esri World Imagery / Dark Canvas (no API keys required)
- **Data Source**: NASA EOSDIS FIRMS Area API

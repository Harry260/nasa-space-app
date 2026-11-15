import Papa from 'papaparse'

export const SENSORS = {
  modis: { label: 'MODIS', api: 'MODIS_NRT', color: '#ff9900' },
  viirs: { label: 'VIIRS NOAA-20', api: 'VIIRS_NOAA20_NRT', color: '#ff3b30' },
}

export const REGION_CATEGORIES = [
  {
    category: 'Continents & World',
    regions: [
      'South Asia',
      'India',
      'Southeast Asia',
      'East Asia',
      'Europe',
      'North America',
      'South America',
      'Africa',
      'Australia',
      'Middle East',
    ],
  },
  {
    category: 'Global Wildfire Hotspots',
    regions: [
      'United States',
      'Canada',
      'Brazil',
      'Indonesia',
      'California (US)',
      'Spain',
      'Portugal',
      'Greece',
      'Siberia (Russia)',
      'Chile',
      'Argentina',
      'South Africa',
      'Mexico',
    ],
  },
  {
    category: 'Indian States & Regions',
    regions: [
      'Kerala',
      'Punjab',
      'Haryana',
      'Uttar Pradesh',
      'Madhya Pradesh',
      'Maharashtra',
      'Karnataka',
      'Tamil Nadu',
      'Odisha',
      'Chhattisgarh',
      'Gujarat',
      'Rajasthan',
      'Uttarakhand',
      'Himachal Pradesh',
    ],
  },
]

// [west, south, east, north]
export const REGIONS = {
  // Pinned Regions
  Kerala: [74.8, 8.0, 77.5, 12.9],
  India: [68.0, 6.0, 97.5, 37.0],
  'South Asia': [60.0, 5.0, 100.0, 40.0],

  // Continents & Major Geographies
  'Southeast Asia': [92.0, -11.0, 141.0, 28.0],
  'East Asia': [73.0, 18.0, 145.0, 54.0],
  Europe: [-15.0, 34.0, 42.0, 71.0],
  'North America': [-168.0, 14.0, -52.0, 72.0],
  'South America': [-82.0, -56.0, -34.0, 13.0],
  Africa: [-18.0, -35.0, 52.0, 38.0],
  Australia: [112.0, -44.0, 154.0, -10.0],
  'Middle East': [34.0, 12.0, 64.0, 42.0],

  // Global Wildfire Hotspot Regions & Nations
  'United States': [-125.0, 24.5, -66.9, 49.4],
  Canada: [-141.0, 41.7, -52.6, 75.0],
  Brazil: [-74.0, -33.7, -34.8, 5.3],
  Indonesia: [95.0, -11.0, 141.0, 6.0],
  'California (US)': [-124.5, 32.5, -114.1, 42.0],
  Spain: [-9.5, 35.9, 3.4, 43.8],
  Portugal: [-9.6, 36.9, -6.1, 42.2],
  Greece: [19.3, 34.8, 28.3, 41.8],
  'Siberia (Russia)': [60.0, 50.0, 170.0, 75.0],
  Chile: [-75.7, -56.0, -66.9, -17.5],
  Argentina: [-73.6, -55.1, -53.6, -21.8],
  'South Africa': [16.4, -34.9, 32.9, -22.1],
  Mexico: [-118.4, 14.5, -86.7, 32.7],

  // Indian States & Agricultural Fire Zones
  Punjab: [73.8, 29.5, 76.9, 32.5],
  Haryana: [74.4, 27.6, 77.6, 30.9],
  'Uttar Pradesh': [77.0, 23.8, 84.7, 30.4],
  'Madhya Pradesh': [74.0, 21.3, 82.8, 26.9],
  Maharashtra: [72.6, 15.6, 80.9, 22.0],
  Karnataka: [74.0, 11.5, 78.6, 18.5],
  'Tamil Nadu': [76.2, 8.0, 80.3, 13.6],
  Odisha: [81.3, 17.8, 87.5, 22.6],
  Chhattisgarh: [80.2, 17.8, 84.4, 24.1],
  Gujarat: [68.1, 20.1, 74.5, 24.7],
  Rajasthan: [69.5, 23.0, 78.3, 30.2],
  Uttarakhand: [77.5, 28.7, 81.1, 31.5],
  'Himachal Pradesh': [75.6, 30.4, 79.0, 33.2],
}

export function detectDefaultRegion() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    if (tz.includes('Kolkata') || tz.includes('Calcutta') || tz.includes('India')) {
      return 'Kerala'
    }
    if (tz.includes('America') || tz.includes('US') || tz.includes('New_York') || tz.includes('Los_Angeles') || tz.includes('Chicago')) {
      return 'United States'
    }
    if (tz.includes('Europe') || tz.includes('London') || tz.includes('Paris') || tz.includes('Berlin') || tz.includes('Madrid')) {
      return 'Europe'
    }
    if (tz.includes('Australia') || tz.includes('Sydney') || tz.includes('Melbourne')) {
      return 'Australia'
    }
    if (tz.includes('Sao_Paulo') || tz.includes('Buenos_Aires')) {
      return 'Brazil'
    }
  } catch {}
  return 'Kerala'
}

function urlFor(key, { region, days }) {
  const s = SENSORS[key]
  const bbox = REGIONS[region] || REGIONS.Kerala
  return `/firms/${s.api}/${bbox.join(',')}/${days}`
}

async function explain() {
  try {
    return (await (await fetch('/keycheck')).json()).message
  } catch {
    return 'Dev server not reachable. Run npm run dev and open the localhost link it prints.'
  }
}

export async function fetchSensor(key, opts) {
  const res = await fetch(urlFor(key, opts))
  const text = await res.text()
  if (!res.ok || !text.trimStart().startsWith('latitude')) {
    const hint = await explain()
    throw new Error(`${SENSORS[key].label}: ${res.status} ${text.slice(0, 100)} | ${hint}`)
  }
  const [w, s, e, n] = REGIONS[opts.region] || REGIONS.Kerala
  return Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true })
    .data.map((r) => ({
      lat: r.latitude,
      lon: r.longitude,
      date: String(r.acq_date),
      time: String(r.acq_time).padStart(4, '0'),
      frp: Number(r.frp) || 0,
      bright: r.brightness ?? r.bright_ti4,
      high: r.confidence === 'h' || (typeof r.confidence === 'number' && r.confidence >= 80),
      night: r.daynight === 'N',
    }))
    .filter((r) => r.lon >= w && r.lon <= e && r.lat >= s && r.lat <= n)
}

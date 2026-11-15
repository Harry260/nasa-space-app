import Papa from 'papaparse'

export const SENSORS = {
  modis: { label: 'MODIS', api: 'MODIS_NRT', dir: 'modis-c6.1', file: 'MODIS_C6_1', color: '#ffb020' },
  viirs: { label: 'VIIRS NOAA-20', api: 'VIIRS_NOAA20_NRT', dir: 'noaa-20-viirs-c2', file: 'J1_VIIRS_C2', color: '#ff3b30' },
}

// [west, south, east, north]
export const REGIONS = {
  Kerala: [74.8, 8.0, 77.5, 12.9],
  India: [68, 6, 98, 36],
  'South Asia': [60, 5, 100, 40],
}

function urlFor(key, { mode, region, days }) {
  const s = SENSORS[key]
  if (mode === 'api') return `/firms/${s.api}/${REGIONS[region].join(',')}/${days}`
  const span = days <= 1 ? '24h' : days <= 2 ? '48h' : '7d'
  return `/nrt3/archive/FIRMS/${s.dir}/South_Asia/${s.file}_South_Asia_${span}.csv`
}

async function explain(mode, status) {
  if (mode === 'api') {
    try {
      return (await (await fetch('/keycheck')).json()).message
    } catch {
      return 'Dev server not reachable. Run npm run dev and open the localhost link it prints.'
    }
  }
  return status === 401 || status === 403
    ? 'Earthdata token missing, wrong or expired. Set EARTHDATA_TOKEN in .env.'
    : ''
}

export async function fetchSensor(key, opts) {
  const res = await fetch(urlFor(key, opts))
  const text = await res.text()
  if (!res.ok || !text.trimStart().startsWith('latitude')) {
    const hint = await explain(opts.mode, res.status)
    throw new Error(`${SENSORS[key].label}: ${res.status} ${text.slice(0, 100)} | ${hint}`)
  }
  const [w, s, e, n] = REGIONS[opts.region]
  return Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true })
    .data.map((r) => ({
      lat: r.latitude,
      lon: r.longitude,
      date: String(r.acq_date),
      time: String(r.acq_time).padStart(4, '0'),
      frp: Number(r.frp) || 0,
      bright: r.brightness ?? r.bright_ti4,
      // VIIRS confidence = l/n/h letters, MODIS = 0-100 number
      high: r.confidence === 'h' || (typeof r.confidence === 'number' && r.confidence >= 80),
      night: r.daynight === 'N',
    }))
    .filter((r) => r.lon >= w && r.lon <= e && r.lat >= s && r.lat <= n)
}

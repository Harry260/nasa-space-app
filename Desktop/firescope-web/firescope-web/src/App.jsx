import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { SENSORS, REGIONS, fetchSensor } from './api'
import { summarize, byDay, countMatched } from './analysis'

function Fit({ region }) {
  const map = useMap()
  useEffect(() => {
    const [w, s, e, n] = REGIONS[region]
    map.fitBounds([[s, w], [n, e]])
  }, [region, map])
  return null
}

export default function App() {
  const [mode, setMode] = useState('api')
  const [region, setRegion] = useState('Kerala')
  const [days, setDays] = useState(2)
  const [show, setShow] = useState({ modis: true, viirs: true })
  const [data, setData] = useState({ modis: [], viirs: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let dead = false
    setLoading(true)
    setError('')
    Promise.all(Object.keys(SENSORS).map((k) => fetchSensor(k, { mode, region, days })))
      .then(([modis, viirs]) => !dead && setData({ modis, viirs }))
      .catch((e) => !dead && setError(e.message))
      .finally(() => !dead && setLoading(false))
    return () => { dead = true }
  }, [mode, region, days])

  const stats = useMemo(() => ({ modis: summarize(data.modis), viirs: summarize(data.viirs) }), [data])
  const daily = useMemo(() => byDay(data.modis, data.viirs), [data])
  const matched = useMemo(() => countMatched(data.modis, data.viirs), [data])
  const pct = stats.modis.count ? Math.round((matched / stats.modis.count) * 100) : 0

  return (
    <div className="app">
      <aside className="side">
        <h1>FireScope</h1>
        <p className="sub">MODIS vs VIIRS fire detections, live from NASA FIRMS</p>

        <label>Data source
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="api">FIRMS API (map key)</option>
            <option value="archive">NRT archive (Earthdata token)</option>
          </select>
        </label>
        <label>Region
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            {Object.keys(REGIONS).map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label>Last {days} day{days > 1 ? 's' : ''}
          <input type="range" min="1" max="5" value={days} onChange={(e) => setDays(+e.target.value)} />
        </label>
        {mode === 'archive' && <p className="hint">Archive has 24h / 48h / 7d files only. Days 1 = 24h, 2 = 48h, 3+ = 7d.</p>}

        {Object.entries(SENSORS).map(([k, s]) => (
          <section key={k} className="card" style={{ borderColor: s.color }}>
            <label className="row">
              <input type="checkbox" checked={show[k]} onChange={(e) => setShow({ ...show, [k]: e.target.checked })} />
              <b style={{ color: s.color }}>{s.label}</b>
            </label>
            <div className="big">{stats[k].count.toLocaleString()}</div>
            <div className="small">detections</div>
            <div className="grid">
              <span>Mean FRP</span><span>{stats[k].meanFrp.toFixed(1)} MW</span>
              <span>High confidence</span><span>{stats[k].high}</span>
              <span>Night</span><span>{stats[k].night}</span>
            </div>
          </section>
        ))}

        <section className="card">
          <b>Overlap</b>
          <div className="big">{pct}%</div>
          <div className="small">of MODIS detections have a VIIRS detection within 1 km, same date ({matched} of {stats.modis.count})</div>
        </section>
      </aside>

      <main className="main">
        {loading && <div className="banner">Loading NASA data…</div>}
        {error && <div className="banner err">{error}</div>}
        <div className="map">
          <MapContainer center={[10.5, 76.2]} zoom={7} preferCanvas style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; OpenStreetMap &copy; CARTO"
            />
            <Fit region={region} />
            {Object.keys(SENSORS).map((k) => show[k] && data[k].map((r, i) => (
              <CircleMarker
                key={k + i}
                center={[r.lat, r.lon]}
                radius={k === 'modis' ? 7 : 3}
                pathOptions={{ color: SENSORS[k].color, weight: 1, fillOpacity: k === 'modis' ? 0.3 : 0.85 }}
              >
                <Popup>
                  <b>{SENSORS[k].label}</b><br />
                  {r.date} {r.time.slice(0, 2)}:{r.time.slice(2)} UTC<br />
                  FRP {r.frp} MW · brightness {r.bright} K<br />
                  {r.high ? 'high' : 'low/nominal'} confidence · {r.night ? 'night' : 'day'}
                </Popup>
              </CircleMarker>
            )))}
          </MapContainer>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily}>
              <CartesianGrid stroke="#2a2220" vertical={false} />
              <XAxis dataKey="date" stroke="#9a8a80" />
              <YAxis stroke="#9a8a80" />
              <Tooltip contentStyle={{ background: '#1a1412', border: '1px solid #3a2e29' }} />
              <Legend />
              <Bar dataKey="MODIS" fill={SENSORS.modis.color} />
              <Bar dataKey="VIIRS" fill={SENSORS.viirs.color} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </main>
    </div>
  )
}

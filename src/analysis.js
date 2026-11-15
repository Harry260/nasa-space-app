export function summarize(rows) {
  const count = rows.length
  const sum = rows.reduce((a, r) => a + r.frp, 0)
  return {
    count,
    meanFrp: count ? sum / count : 0,
    high: rows.filter((r) => r.high).length,
    night: rows.filter((r) => r.night).length,
  }
}

export function byDay(modis, viirs) {
  const days = {}
  for (const [k, rows] of [['MODIS', modis], ['VIIRS', viirs]]) {
    for (const r of rows) {
      days[r.date] ??= { date: r.date, MODIS: 0, VIIRS: 0 }
      days[r.date][k]++
    }
  }
  return Object.values(days).sort((a, b) => a.date.localeCompare(b.date))
}

// MODIS detections with a VIIRS detection within 1 km on the same date.
export function countMatched(modis, viirs, km = 1) {
  const cell = 0.01
  const grid = new Map()
  const key = (d, x, y) => `${d}|${x}|${y}`
  for (const v of viirs) {
    const k = key(v.date, Math.floor(v.lat / cell), Math.floor(v.lon / cell))
    if (!grid.has(k)) grid.set(k, [])
    grid.get(k).push(v)
  }
  let matched = 0
  for (const m of modis) {
    const cx = Math.floor(m.lat / cell)
    const cy = Math.floor(m.lon / cell)
    let hit = false
    for (let dx = -1; dx <= 1 && !hit; dx++) {
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        for (const v of grid.get(key(m.date, cx + dx, cy + dy)) || []) {
          const dLat = (v.lat - m.lat) * 111
          const dLon = (v.lon - m.lon) * 111 * Math.cos((m.lat * Math.PI) / 180)
          if (Math.hypot(dLat, dLon) <= km) { hit = true; break }
        }
      }
    }
    if (hit) matched++
  }
  return matched
}

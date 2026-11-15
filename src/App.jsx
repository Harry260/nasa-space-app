import { useEffect, useMemo, useState, useRef } from 'react'
import GradualBlur from 'gradualblur'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import {
  SENSORS,
  REGIONS,
  REGION_CATEGORIES,
  fetchSensor,
  detectDefaultRegion,
} from './api'
import { summarize, byDay, countMatched } from './analysis'
import MapLibreMap from './MapLibreMap'

export default function App() {
  // Remember region from localStorage or detect automatically
  const [region, setRegion] = useState(() => {
    try {
      const saved = localStorage.getItem('firescope_region')
      if (saved && REGIONS[saved]) return saved
    } catch {}
    return detectDefaultRegion()
  })

  // Remember search history from localStorage
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('firescope_search_history')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed.filter((r) => REGIONS[r])
      }
    } catch {}
    return ['Kerala', 'India']
  })

  const [days, setDays] = useState(2)
  const [mapView, setMapView] = useState('normal') // 'normal' | 'earth' | 'dark'
  const [projection, setProjection] = useState('mercator') // 'mercator' | 'globe'
  const [show, setShow] = useState({ modis: true, viirs: true })
  const [data, setData] = useState({ modis: [], viirs: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Collapsible & popover states
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false)
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false)
  const [regionSearch, setRegionSearch] = useState('')
  const searchInputRef = useRef(null)

  // Derived UI Theme: Light for Normal view, Dark for Earth and Dark views
  const isDarkTheme = mapView === 'dark' || mapView === 'earth'
  const themeMode = isDarkTheme ? 'dark' : 'light'

  // Fetch FIRMS telemetry
  const loadData = () => {
    let dead = false
    setLoading(true)
    setError('')
    Promise.all(Object.keys(SENSORS).map((k) => fetchSensor(k, { region, days })))
      .then(([modis, viirs]) => !dead && setData({ modis, viirs }))
      .catch((e) => !dead && setError(e.message))
      .finally(() => !dead && setLoading(false))
    return () => { dead = true }
  }

  useEffect(() => {
    return loadData()
  }, [region, days])

  // Select region helper with persistence
  const handleSelectRegion = (selectedRegion) => {
    if (!REGIONS[selectedRegion]) return
    setRegion(selectedRegion)
    setIsRegionModalOpen(false)
    try {
      localStorage.setItem('firescope_region', selectedRegion)
      setSearchHistory((prev) => {
        const next = [selectedRegion, ...prev.filter((r) => r !== selectedRegion)].slice(0, 8)
        localStorage.setItem('firescope_search_history', JSON.stringify(next))
        return next
      })
    } catch {}
  }

  // Clear search history
  const handleClearHistory = (e) => {
    e.stopPropagation()
    setSearchHistory([])
    try {
      localStorage.removeItem('firescope_search_history')
    } catch {}
  }

  // Focus search input when modal opens
  useEffect(() => {
    if (isRegionModalOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 80)
    } else {
      setRegionSearch('')
    }
  }, [isRegionModalOpen])

  // Close region modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsRegionModalOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const stats = useMemo(() => ({
    modis: summarize(data.modis),
    viirs: summarize(data.viirs),
  }), [data])

  const totalDetections = stats.modis.count + stats.viirs.count
  const daily = useMemo(() => byDay(data.modis, data.viirs), [data])
  const matched = useMemo(() => countMatched(data.modis, data.viirs), [data])
  const pct = stats.modis.count ? Math.round((matched / stats.modis.count) * 100) : 0

  const peakDay = useMemo(() => {
    if (!daily.length) return null
    return daily.reduce((max, d) => {
      const sum = (d.MODIS || 0) + (d.VIIRS || 0)
      return sum > max.total ? { date: d.date, total: sum } : max
    }, { date: '', total: 0 })
  }, [daily])

  const avgPerDay = daily.length ? Math.round(totalDetections / daily.length) : 0

  // Filtered categories for region search
  const filteredCategories = useMemo(() => {
    const q = regionSearch.trim().toLowerCase()
    if (!q) return REGION_CATEGORIES

    const matches = Object.keys(REGIONS).filter((r) =>
      r.toLowerCase().includes(q)
    )
    return [
      {
        category: `Matching Regions (${matches.length})`,
        regions: matches,
      },
    ]
  }, [regionSearch])

  return (
    <div className="app-container" data-theme={themeMode}>
      {/* 1. Fullscreen Map Background */}
      <div className="fullscreen-map">
        <MapLibreMap
          region={region}
          mapView={mapView}
          projection={projection}
          show={show}
          data={data}
        />
      </div>

      {/* 2. Progressive Blur Header (Optimized for 60fps performance) */}
      <GradualBlur
        target="page"
        position="top"
        height="5.2rem"
        strength={1.2}
        divCount={3}
        exponential={false}
        zIndex={10}
        style={{ zIndex: 10, pointerEvents: 'none' }}
        opacity={0.88}
      />

      {/* 3. Floating Apple-Style Header */}
      <header className="floating-header">
        {/* Brand */}
        <div className="header-brand">
          <div className="brand-badge">
            <span className="brand-logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              </svg>
            </span>
            <span className="brand-title">FireScope</span>
          </div>
        </div>

        {/* Center: Basemap & Projection Switchers with Crisp Vector SVG Icons */}
        <div className="header-controls">
          {/* Basemap Switcher */}
          <div className="pill-group">
            <button
              type="button"
              className={`pill-btn ${mapView === 'normal' ? 'active' : ''}`}
              onClick={() => setMapView('normal')}
              title="Standard Graphical Map (Light Theme)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6" />
                <line x1="9" y1="3" x2="9" y2="18" />
                <line x1="15" y1="6" x2="15" y2="21" />
              </svg>
              <span>Normal</span>
            </button>
            <button
              type="button"
              className={`pill-btn ${mapView === 'earth' ? 'active' : ''}`}
              onClick={() => setMapView('earth')}
              title="Satellite Earth Imagery (Dark Theme)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
              <span>Earth</span>
            </button>
            <button
              type="button"
              className={`pill-btn ${mapView === 'dark' ? 'active' : ''}`}
              onClick={() => setMapView('dark')}
              title="High-Contrast Dark Basemap (Dark Theme)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span>Dark</span>
            </button>
          </div>

          {/* 2D Flat / 3D Globe Projection Switcher */}
          <div className="pill-group">
            <button
              type="button"
              className={`pill-btn ${projection === 'mercator' ? 'active' : ''}`}
              onClick={() => setProjection('mercator')}
              title="Flat 2D Projection"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <span>2D Flat</span>
            </button>
            <button
              type="button"
              className={`pill-btn ${projection === 'globe' ? 'active' : ''}`}
              onClick={() => setProjection('globe')}
              title="Interactive 3D Earth Globe"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <ellipse cx="12" cy="12" rx="4" ry="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
              </svg>
              <span>3D Globe</span>
            </button>
          </div>
        </div>

        {/* Right: Exactly ONE Region Button showing current region -> triggers Search Modal */}
        <div className="header-actions">
          <button
            type="button"
            className={`action-chip region-selector-btn ${isRegionModalOpen ? 'active' : ''}`}
            onClick={() => setIsRegionModalOpen(!isRegionModalOpen)}
            title="Choose a region to monitor"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="region-selector-name">{region}</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isRegionModalOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </header>

      {/* Region Search Dropdown Popover */}
      {isRegionModalOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setIsRegionModalOpen(false)} />
          <div className="region-modal">
            <div className="region-modal-header">
              <div className="region-search-bar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search countries, states, continents…"
                  value={regionSearch}
                  onChange={(e) => setRegionSearch(e.target.value)}
                />
                {regionSearch && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setRegionSearch('')}
                    title="Clear search input"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                type="button"
                className="region-modal-close"
                onClick={() => setIsRegionModalOpen(false)}
                title="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="region-modal-list">
              {/* Recent Searches Section (when not searching and history exists) */}
              {!regionSearch.trim() && searchHistory.length > 0 && (
                <div className="region-group">
                  <div className="region-group-header">
                    <span className="region-group-title">Recent Searches</span>
                    <button
                      type="button"
                      className="clear-history-btn"
                      onClick={handleClearHistory}
                      title="Clear search history"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="region-grid">
                    {searchHistory.map((r) => {
                      const isSelected = region === r
                      return (
                        <button
                          key={`recent-${r}`}
                          type="button"
                          className={`region-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectRegion(r)}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.65, flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span className="region-item-text">{r}</span>
                          {isSelected && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Categorized Regions (No Pinned category) */}
              {filteredCategories.map((group) => {
                if (!group.regions || !group.regions.length) return null
                return (
                  <div key={group.category} className="region-group">
                    <div className="region-group-header">
                      <span className="region-group-title">{group.category}</span>
                    </div>
                    <div className="region-grid">
                      {group.regions.map((r) => {
                        const isSelected = region === r
                        return (
                          <button
                            key={r}
                            type="button"
                            className={`region-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleSelectRegion(r)}
                          >
                            <span className="region-item-text">{r}</span>
                            {isSelected && (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {filteredCategories.length === 0 || (filteredCategories.length === 1 && !filteredCategories[0].regions.length) ? (
                <div className="region-empty">
                  No regions found matching &ldquo;{regionSearch}&rdquo;
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      {/* 4. Floating Left Control Panel (Collapsible) */}
      <aside className={`floating-panel ${isPanelCollapsed ? 'collapsed' : ''}`}>
        <div className="panel-header" onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}>
          <div className="panel-header-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span>Telemetry</span>
            {isPanelCollapsed && (
              <span className="collapsed-fire-count">
                {totalDetections.toLocaleString()} fires
              </span>
            )}
          </div>
          <button
            type="button"
            className="panel-collapse-btn"
            title={isPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isPanelCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        <div className="panel-body">
          {/* Observation Window */}
          <div className="panel-section">
            <div className="section-label">Observation Window</div>
            <div className="slider-container">
              <div className="slider-row">
                <span>Lookback Period</span>
                <span className="slider-val">{days} Day{days > 1 ? 's' : ''}</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={days}
                onChange={(e) => setDays(+e.target.value)}
              />
            </div>
          </div>

          {/* Sensor Detections */}
          <div className="panel-section">
            <div className="section-label">Active Sensors</div>

            {/* MODIS Card */}
            <div className={`sensor-card ${!show.modis ? 'sensor-card-off' : ''}`}>
              <div className="sensor-card-top">
                <div className="sensor-badge modis-badge">
                  <span className="sensor-status-dot modis" />
                  <span className="sensor-badge-name">MODIS</span>
                  <span className="sensor-badge-res">1 km</span>
                </div>
                <label className="sensor-toggle" title="Toggle MODIS layer">
                  <input
                    type="checkbox"
                    checked={show.modis}
                    onChange={(e) => setShow({ ...show, modis: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="sensor-metric-hero">
                <span className="sensor-count">
                  {stats.modis.count.toLocaleString()}
                </span>
                <span className="sensor-count-label">fires detected</span>
              </div>

              <div className="sensor-stats-row">
                <div className="sensor-stat-box">
                  <span className="stat-box-label">Mean FRP</span>
                  <span className="stat-box-val">{stats.modis.meanFrp.toFixed(1)} <small>MW</small></span>
                </div>
                <div className="sensor-stat-box">
                  <span className="stat-box-label">High Conf</span>
                  <span className="stat-box-val">{stats.modis.high.toLocaleString()}</span>
                </div>
                <div className="sensor-stat-box">
                  <span className="stat-box-label">Night</span>
                  <span className="stat-box-val">{stats.modis.night.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* VIIRS Card */}
            <div className={`sensor-card ${!show.viirs ? 'sensor-card-off' : ''}`}>
              <div className="sensor-card-top">
                <div className="sensor-badge viirs-badge">
                  <span className="sensor-status-dot viirs" />
                  <span className="sensor-badge-name">VIIRS</span>
                  <span className="sensor-badge-res">375 m</span>
                </div>
                <label className="sensor-toggle" title="Toggle VIIRS layer">
                  <input
                    type="checkbox"
                    checked={show.viirs}
                    onChange={(e) => setShow({ ...show, viirs: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="sensor-metric-hero">
                <span className="sensor-count">
                  {stats.viirs.count.toLocaleString()}
                </span>
                <span className="sensor-count-label">fires detected</span>
              </div>

              <div className="sensor-stats-row">
                <div className="sensor-stat-box">
                  <span className="stat-box-label">Mean FRP</span>
                  <span className="stat-box-val">{stats.viirs.meanFrp.toFixed(1)} <small>MW</small></span>
                </div>
                <div className="sensor-stat-box">
                  <span className="stat-box-label">High Conf</span>
                  <span className="stat-box-val">{stats.viirs.high.toLocaleString()}</span>
                </div>
                <div className="sensor-stat-box">
                  <span className="stat-box-label">Night</span>
                  <span className="stat-box-val">{stats.viirs.night.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Spatial Overlap Analysis Card */}
          <div className="panel-section">
            <div className="section-label">Cross-Sensor Verification</div>
            <div className="overlap-card">
              <div className="overlap-hero">
                <span className="overlap-pct">{pct}%</span>
                <span className="overlap-badge">
                  {pct > 50 ? 'Strong Correlation' : 'Independent Data'}
                </span>
              </div>
              <p className="overlap-desc">
                {matched.toLocaleString()} of {stats.modis.count.toLocaleString()} MODIS fire pixels verified by VIIRS within 1 km on the same acquisition date.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* 5. Floating Bottom Analytics Panel (Completely Revamped UI & Hover) */}
      <div className="floating-bottom-tray">
        {/* Toggle Pill Button */}
        <button
          type="button"
          className="tray-toggle-pill"
          onClick={() => setIsAnalyticsOpen(!isAnalyticsOpen)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span>Daily Trend</span>
          <span className="tray-count-badge">{totalDetections.toLocaleString()}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isAnalyticsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Expanded Sheet Card */}
        {isAnalyticsOpen && (
          <div className="analytics-card">
            <div className="analytics-header">
              <div className="analytics-header-left">
                <span className="analytics-title">Daily Acquisition Trend</span>
                <div className="analytics-summary-chips">
                  {peakDay?.total > 0 && (
                    <span className="summary-chip peak">
                      Peak: <b>{peakDay.date}</b> ({peakDay.total.toLocaleString()})
                    </span>
                  )}
                  <span className="summary-chip avg">
                    Avg: <b>{avgPerDay.toLocaleString()}</b> / day
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="analytics-close-btn"
                onClick={() => setIsAnalyticsOpen(false)}
                title="Minimize chart"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="analytics-content">
              {daily.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid
                      stroke={isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke={isDarkTheme ? '#8e8e93' : '#6e6e73'}
                      fontSize={11}
                      tickLine={false}
                      tickMargin={6}
                    />
                    <YAxis
                      stroke={isDarkTheme ? '#8e8e93' : '#6e6e73'}
                      fontSize={11}
                      tickLine={false}
                      tickMargin={6}
                    />
                    <Tooltip
                      cursor={{
                        fill: isDarkTheme ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                        radius: 6,
                      }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null
                        const modisVal = payload.find((p) => p.dataKey === 'MODIS')?.value || 0
                        const viirsVal = payload.find((p) => p.dataKey === 'VIIRS')?.value || 0
                        const dayTotal = modisVal + viirsVal

                        return (
                          <div className="custom-chart-tooltip">
                            <div className="tooltip-header">{label}</div>
                            <div className="tooltip-metric modis">
                              <span className="dot" style={{ background: SENSORS.modis.color }} />
                              <span className="label">MODIS</span>
                              <span className="val">{modisVal.toLocaleString()}</span>
                            </div>
                            <div className="tooltip-metric viirs">
                              <span className="dot" style={{ background: SENSORS.viirs.color }} />
                              <span className="label">VIIRS</span>
                              <span className="val">{viirsVal.toLocaleString()}</span>
                            </div>
                            <div className="tooltip-divider" />
                            <div className="tooltip-total">
                              <span>Total Daily Detections</span>
                              <b>{dayTotal.toLocaleString()}</b>
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Bar
                      dataKey="MODIS"
                      fill={SENSORS.modis.color}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="VIIRS"
                      fill={SENSORS.viirs.color}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-empty-state">
                  No fire detections recorded in this area for the past {days} day{days > 1 ? 's' : ''}.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 6. Blurred Loading Modal Popup */}
      {loading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <span className="loading-text">Fetching Live NASA FIRMS Telemetry…</span>
        </div>
      )}

      {/* 7. Error Notification */}
      {error && (
        <div className="error-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

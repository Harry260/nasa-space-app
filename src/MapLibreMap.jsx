import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import maplibreglWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { SENSORS, REGIONS } from './api'

if (typeof window !== 'undefined' && maplibregl.setWorkerUrl) {
  maplibregl.setWorkerUrl(maplibreglWorker)
}

function toGeoJson(rows, sensorKey) {
  return {
    type: 'FeatureCollection',
    features: (rows || []).map((r, i) => ({
      type: 'Feature',
      id: `${sensorKey}-${i}`,
      geometry: {
        type: 'Point',
        coordinates: [r.lon, r.lat],
      },
      properties: {
        sensor: sensorKey,
        label: SENSORS[sensorKey]?.label || sensorKey,
        color: SENSORS[sensorKey]?.color || '#ff7a1a',
        date: r.date,
        time: r.time,
        frp: r.frp,
        bright: r.bright,
        high: r.high,
        night: r.night,
      },
    })),
  }
}

export default function MapLibreMap({
  region,
  mapView, // 'normal' | 'earth' | 'dark'
  projection, // 'mercator' | 'globe'
  show,
  data,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const popupRef = useRef(null)

  // Keep latest props in refs to avoid stale closures in event callbacks
  const dataRef = useRef(data)
  dataRef.current = data
  const showRef = useRef(show)
  showRef.current = show
  const mapViewRef = useRef(mapView)
  mapViewRef.current = mapView

  // Helper to sync fire data directly into GeoJSON sources
  const syncData = () => {
    const map = mapRef.current
    if (!map) return
    const modisSource = map.getSource('modis-data')
    if (modisSource) {
      modisSource.setData(toGeoJson(dataRef.current.modis, 'modis'))
    }
    const viirsSource = map.getSource('viirs-data')
    if (viirsSource) {
      viirsSource.setData(toGeoJson(dataRef.current.viirs, 'viirs'))
    }
  }

  // Helper to sync layer visibility
  const syncVisibility = () => {
    const map = mapRef.current
    if (!map) return
    const modisVis = showRef.current.modis ? 'visible' : 'none'
    const viirsVis = showRef.current.viirs ? 'visible' : 'none'

    if (map.getLayer('modis-glow')) map.setLayoutProperty('modis-glow', 'visibility', modisVis)
    if (map.getLayer('modis-layer')) map.setLayoutProperty('modis-layer', 'visibility', modisVis)

    if (map.getLayer('viirs-glow')) map.setLayoutProperty('viirs-glow', 'visibility', viirsVis)
    if (map.getLayer('viirs-layer')) map.setLayoutProperty('viirs-layer', 'visibility', viirsVis)
  }

  // Helper to sync basemap view
  const syncBasemap = () => {
    const map = mapRef.current
    if (!map) return
    const currentView = mapViewRef.current

    if (map.getLayer('normal-layer')) {
      map.setLayoutProperty('normal-layer', 'visibility', currentView === 'normal' ? 'visible' : 'none')
    }
    if (map.getLayer('dark-layer')) {
      map.setLayoutProperty('dark-layer', 'visibility', currentView === 'dark' ? 'visible' : 'none')
    }
    if (map.getLayer('dark-labels-layer')) {
      map.setLayoutProperty('dark-labels-layer', 'visibility', currentView === 'dark' ? 'visible' : 'none')
    }
    if (map.getLayer('earth-imagery-layer')) {
      map.setLayoutProperty('earth-imagery-layer', 'visibility', currentView === 'earth' ? 'visible' : 'none')
    }
    if (map.getLayer('earth-labels-layer')) {
      map.setLayoutProperty('earth-labels-layer', 'visibility', currentView === 'earth' ? 'visible' : 'none')
    }
  }

  // Initialize MapLibre Map instance once on mount
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const [w, s, e, n] = REGIONS[region] || [74.8, 8.0, 77.5, 12.9]

    const map = new maplibregl.Map({
      container: containerRef.current,
      attributionControl: false,
      style: {
        version: 8,
        projection: { type: projection },
        sources: {
          // Normal Graphical View (Standard OpenStreetMap - 100% Free, NO API Key)
          'osm-normal': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxzoom: 19,
          },
          // Earth Satellite View (Esri World Imagery - 100% Free, NO API Key)
          'esri-imagery': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Tiles &copy; Esri &mdash; Earthstar Geographics',
            maxzoom: 19,
          },
          // Earth Labels & Boundaries (100% Free, NO API Key)
          'esri-labels': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            maxzoom: 19,
          },
          // Dark High-Contrast View (Esri Dark Canvas - 100% Free, NO API Key)
          'esri-dark-base': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
            maxzoom: 16,
          },
          'esri-dark-labels': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            maxzoom: 16,
          },
        },
        layers: [
          {
            id: 'normal-layer',
            type: 'raster',
            source: 'osm-normal',
            layout: { visibility: mapViewRef.current === 'normal' ? 'visible' : 'none' },
            minzoom: 0,
            maxzoom: 19,
          },
          {
            id: 'dark-layer',
            type: 'raster',
            source: 'esri-dark-base',
            layout: { visibility: mapViewRef.current === 'dark' ? 'visible' : 'none' },
            minzoom: 0,
            maxzoom: 16,
          },
          {
            id: 'dark-labels-layer',
            type: 'raster',
            source: 'esri-dark-labels',
            layout: { visibility: mapViewRef.current === 'dark' ? 'visible' : 'none' },
            minzoom: 0,
            maxzoom: 16,
          },
          {
            id: 'earth-imagery-layer',
            type: 'raster',
            source: 'esri-imagery',
            layout: { visibility: mapViewRef.current === 'earth' ? 'visible' : 'none' },
            minzoom: 0,
            maxzoom: 19,
          },
          {
            id: 'earth-labels-layer',
            type: 'raster',
            source: 'esri-labels',
            layout: { visibility: mapViewRef.current === 'earth' ? 'visible' : 'none' },
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [(w + e) / 2, (s + n) / 2],
      zoom: 6,
    })

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    map.on('load', () => {
      // 1. MODIS source and glow + core layers
      map.addSource('modis-data', {
        type: 'geojson',
        data: toGeoJson(dataRef.current.modis, 'modis'),
      })

      map.addLayer({
        id: 'modis-glow',
        type: 'circle',
        source: 'modis-data',
        layout: { visibility: showRef.current.modis ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 9, 6, 14, 10, 20, 14, 26],
          'circle-color': '#ff9900',
          'circle-opacity': 0.35,
          'circle-blur': 0.6,
        },
      })

      map.addLayer({
        id: 'modis-layer',
        type: 'circle',
        source: 'modis-data',
        layout: { visibility: showRef.current.modis ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 6, 8, 10, 11, 14, 15],
          'circle-color': SENSORS.modis.color,
          'circle-opacity': 0.85,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      // 2. VIIRS source and glow + core layers
      map.addSource('viirs-data', {
        type: 'geojson',
        data: toGeoJson(dataRef.current.viirs, 'viirs'),
      })

      map.addLayer({
        id: 'viirs-glow',
        type: 'circle',
        source: 'viirs-data',
        layout: { visibility: showRef.current.viirs ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 7, 6, 11, 10, 16, 14, 22],
          'circle-color': '#ff2200',
          'circle-opacity': 0.4,
          'circle-blur': 0.5,
        },
      })

      map.addLayer({
        id: 'viirs-layer',
        type: 'circle',
        source: 'viirs-data',
        layout: { visibility: showRef.current.viirs ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3.5, 6, 5.5, 10, 8, 14, 11],
          'circle-color': SENSORS.viirs.color,
          'circle-opacity': 0.95,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Sync fresh data immediately upon load
      syncData()
      syncVisibility()
      syncBasemap()

      // Popups
      const showPopup = (e) => {
        if (!e.features || !e.features.length) return
        const p = e.features[0].properties
        const timeStr = String(p.time).padStart(4, '0')
        const html = `
          <div style="font-family: inherit; font-size: 13px; line-height: 1.5; min-width: 180px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${p.color}; border: 1px solid #fff;"></span>
              <b style="color: ${p.color}; font-size: 14px;">${p.label}</b>
            </div>
            <div style="color: #c9b8ac; font-size: 12px; margin-bottom: 4px;">
              <b>Date:</b> ${p.date} &bull; <b>${timeStr.slice(0, 2)}:${timeStr.slice(2)} UTC</b>
            </div>
            <div style="margin-bottom: 4px;">
              <b>Fire Power:</b> <span style="color: #ff9900; font-weight: bold;">${p.frp} MW</span>
            </div>
            <div style="margin-bottom: 6px;">
              <b>Brightness:</b> ${p.bright} K
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="display: inline-block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 7px; border-radius: 9999px; background: ${p.high ? 'rgba(52, 199, 89, 0.18)' : 'rgba(255, 149, 0, 0.18)'}; color: ${p.high ? '#34c759' : '#ff9500'}; border: 1px solid ${p.high ? 'rgba(52, 199, 89, 0.35)' : 'rgba(255, 149, 0, 0.35)'};">
                ${p.high ? 'High Confidence' : 'Nominal Confidence'}
              </span>
              <span style="display: inline-block; font-size: 10px; font-weight: 500; padding: 2px 7px; border-radius: 9999px; background: rgba(255, 255, 255, 0.08); color: #8e8e93; border: 1px solid rgba(255, 255, 255, 0.12);">
                ${p.night ? 'Night Acquisition' : 'Day Acquisition'}
              </span>
            </div>
          </div>
        `
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map)
      }

      map.on('click', 'modis-layer', showPopup)
      map.on('click', 'viirs-layer', showPopup)

      const mouseEnter = () => { map.getCanvas().style.cursor = 'pointer' }
      const mouseLeave = () => { map.getCanvas().style.cursor = '' }
      map.on('mouseenter', 'modis-layer', mouseEnter)
      map.on('mouseleave', 'modis-layer', mouseLeave)
      map.on('mouseenter', 'viirs-layer', mouseEnter)
      map.on('mouseleave', 'viirs-layer', mouseLeave)

      map.fitBounds([[w, s], [e, n]], { padding: 40, duration: 1000 })
    })

    mapRef.current = map

    const ro = new ResizeObserver(() => {
      map.resize()
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      if (popupRef.current) popupRef.current.remove()
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Synchronize region bounding box changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !REGIONS[region]) return
    const [w, s, e, n] = REGIONS[region]
    map.fitBounds([[w, s], [e, n]], { padding: 40, duration: 1000 })
  }, [region])

  // Synchronize basemap view changes
  useEffect(() => {
    syncBasemap()
  }, [mapView])

  // Synchronize 3D Globe vs 2D Mercator switches
  useEffect(() => {
    const map = mapRef.current
    if (!map || typeof map.setProjection !== 'function') return
    const applyProj = () => {
      try {
        map.setProjection({ type: projection })
      } catch (e) {
        console.warn('Projection error:', e)
      }
    }
    if (map.isStyleLoaded()) {
      applyProj()
    } else {
      map.once('load', applyProj)
    }
  }, [projection])

  // Synchronize fire data whenever data prop changes
  useEffect(() => {
    syncData()
  }, [data])

  // Synchronize layer visibility whenever show prop changes
  useEffect(() => {
    syncVisibility()
  }, [show])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    />
  )
}

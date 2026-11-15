import type { StyleSpecification } from 'maplibre-gl'
import { CATEGORIES, CATEGORY_KEYS, HOOD } from './config'

// A hand-drawn-ish look on free vector tiles (OpenFreeMap, OpenMapTiles schema, no API key):
// paper ground, thick ink outlines, 3D buildings. Homes stay a quiet grey; a building only gets
// colour when there is somewhere to go inside it (CartoonMap tags those with the venue's category).
export const INK = '#25223a'
const PAPER = '#fdf3d7'
const HOUSE = '#e9e6e1'
const w = (z12: number, z16: number, z19: number) => ['interpolate', ['exponential', 1.6], ['zoom'], 12, z12, 16, z16, 19, z19] as unknown as number
const roadClass = (...c: string[]) => ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'class'], ['literal', c]], ['!=', ['get', 'brunnel'], 'tunnel']] as unknown as boolean
const MAJOR = ['motorway', 'trunk', 'primary'], MEDIUM = ['secondary', 'tertiary'], MINOR = ['minor', 'service', 'busway']
const venueColour = ['match', ['get', 'cat'], ...CATEGORY_KEYS.flatMap(k => [k, CATEGORIES[k].color]), HOUSE] as unknown as string

const RINGS = [HOOD.ring, ...HOOD.extras.map(e => e.ring)] // the borough, plus the parks let in from next door
const WORLD = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]

export const cartoonStyle = (): StyleSpecification => ({
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
    // the whole world with a neighbourhood-shaped hole in it
    outside: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [WORLD, ...RINGS] } } },
    'venue-buildings': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }, // filled in by CartoonMap
    edge: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: RINGS } } },
  },
  light: { anchor: 'viewport', color: '#ffffff', intensity: 0.25, position: [1.3, 210, 35] },
  sky: { 'sky-color': '#aee3ff', 'horizon-color': '#ffe9c7', 'fog-color': '#fff3da', 'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.75 },
  layers: [
    { id: 'paper', type: 'background', paint: { 'background-color': PAPER } },
    { id: 'landuse', type: 'fill', source: 'omt', 'source-layer': 'landuse', paint: { 'fill-color': ['match', ['get', 'class'], ['commercial', 'retail'], '#fbe9cf', ['school', 'university', 'college', 'hospital'], '#f7e6ea', 'cemetery', '#cfe8bf', ['pitch', 'stadium', 'playground', 'track'], '#a9e391', 'railway', '#ece2c8', 'rgba(0,0,0,0)'] } },
    { id: 'green', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['grass', 'wood', 'farmland', 'wetland']]], paint: { 'fill-color': ['match', ['get', 'class'], 'wood', '#93d886', '#b5e79c'] } },
    { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': '#b5e79c' } },
    { id: 'green-ink', type: 'line', source: 'omt', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['grass', 'wood']]], minzoom: 14, paint: { 'line-color': '#4e9a56', 'line-width': 1.5, 'line-dasharray': [3, 2] } },
    { id: 'pitch-ink', type: 'line', source: 'omt', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['pitch', 'stadium', 'track']]], minzoom: 14, paint: { 'line-color': '#ffffff', 'line-width': 2 } },
    { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': '#8fd7ff' } },
    { id: 'water-ink', type: 'line', source: 'omt', 'source-layer': 'water', paint: { 'line-color': '#2f86c5', 'line-width': 2 } },
    { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: { 'line-color': '#8fd7ff', 'line-width': w(1, 4, 10) } },

    { id: 'path', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: roadClass('path', 'pedestrian', 'track'), minzoom: 14, paint: { 'line-color': '#c99a6b', 'line-width': w(0.5, 1.6, 4), 'line-dasharray': [2, 1.5] } },
    ...([['minor', MINOR, 0.8, 6, 20, 13], ['medium', MEDIUM, 2, 10, 30, 0], ['major', MAJOR, 3, 14, 40, 0]] as const).map(([id, classes, a, b, c, minzoom]) =>
      ({ id: `${id}-ink`, type: 'line' as const, source: 'omt', 'source-layer': 'transportation', filter: roadClass(...classes), minzoom, layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const }, paint: { 'line-color': INK, 'line-width': w(a + 1.2, b + 3, c + 5) } })),
    ...([['minor', MINOR, 0.8, 6, 20, 13, '#ffffff'], ['medium', MEDIUM, 2, 10, 30, 0, '#fff4c9'], ['major', MAJOR, 3, 14, 40, 0, '#ffd978']] as const).map(([id, classes, a, b, c, minzoom, colour]) =>
      ({ id, type: 'line' as const, source: 'omt', 'source-layer': 'transportation', filter: roadClass(...classes), minzoom, layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const }, paint: { 'line-color': colour, 'line-width': w(a, b, c) } })),
    { id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: roadClass('rail', 'transit'), paint: { 'line-color': '#6b6585', 'line-width': w(1, 3, 6) } },
    { id: 'rail-ties', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: roadClass('rail', 'transit'), minzoom: 13, paint: { 'line-color': PAPER, 'line-width': w(0.4, 1.4, 3), 'line-dasharray': [2, 2] } },

    { id: 'building-flat', type: 'fill', source: 'omt', 'source-layer': 'building', maxzoom: 14, paint: { 'fill-color': HOUSE, 'fill-outline-color': '#b9b4ab' } },
    { id: 'building-ink', type: 'line', source: 'omt', 'source-layer': 'building', minzoom: 14, paint: { 'line-color': INK, 'line-width': w(0.5, 2.2, 4) } },
    { id: 'building-3d', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 14, paint: {
      'fill-extrusion-color': HOUSE,
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.6, ['coalesce', ['get', 'render_height'], 8]], // true heights
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-vertical-gradient': true,
    } },

    { id: 'venue-3d', type: 'fill-extrusion', source: 'venue-buildings', minzoom: 14, paint: { 'fill-extrusion-color': venueColour, 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-vertical-gradient': true } },

    // everything that isn't the neighbourhood fades to grey, with a dashed "edge of the map" line
    { id: 'outside', type: 'fill', source: 'outside', paint: { 'fill-color': '#8f8c96', 'fill-opacity': 0.82 } },
    { id: 'edge-glow', type: 'line', source: 'edge', layout: { 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 8 } },
    { id: 'edge', type: 'line', source: 'edge', layout: { 'line-join': 'round' }, paint: { 'line-color': INK, 'line-width': 3, 'line-dasharray': [3, 2] } },

    { id: 'road-name', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 14.5, layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 18, 14], 'text-letter-spacing': 0.05 }, paint: { 'text-color': '#5a5475', 'text-halo-color': PAPER, 'text-halo-width': 2 } },
    { id: 'place-name', type: 'symbol', source: 'omt', 'source-layer': 'place', filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood']]], maxzoom: 15.5, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 15, 'text-transform': 'uppercase', 'text-letter-spacing': 0.18, 'text-max-width': 7 }, paint: { 'text-color': INK, 'text-halo-color': PAPER, 'text-halo-width': 2.5, 'text-opacity': 0.75 } },
  ],
})

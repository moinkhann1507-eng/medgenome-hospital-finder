// Type declarations for Leaflet (loaded via CDN script tag)
declare namespace L {
  class Map {
    setView(center: [number, number], zoom: number): Map
    fitBounds(bounds: LatLngBounds, options?: Record<string, unknown>): Map
    addLayer(layer: Layer): Map
    removeLayer(layer: Layer): Map
    on(event: string, callback: Function): Map
  }
  
  class Marker {
    addTo(map: Map): Marker
    on(event: string, callback: Function): Marker
    bindTooltip(content: string, options?: Record<string, unknown>): Marker
  }
  
  class Layer {}
  
  class TileLayer extends Layer {
    addTo(map: Map): TileLayer
  }
  
  class LatLngBounds {
    constructor(latlngs: Array<[number, number]>)
  }
  
  class DivIcon {
    constructor(options: { html: string; className?: string; iconSize?: [number, number]; iconAnchor?: [number, number] })
  }
  
  function map(element: HTMLElement | string, options?: Record<string, unknown>): Map
  function tileLayer(url: string, options?: Record<string, unknown>): TileLayer
  function marker(latlng: [number, number], options?: Record<string, unknown>): Marker
  function divIcon(options: { html: string; className?: string; iconSize?: [number, number]; iconAnchor?: [number, number] }): DivIcon
  function latLngBounds(latlngs: Array<[number, number]>): LatLngBounds
}

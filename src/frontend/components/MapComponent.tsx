import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

// Set Mapbox access token
mapboxgl.accessToken = process.env.MAPBOX_TOKEN || '';

type MapComponentProps = {
  geometry?: {
    type: string;
    coordinates: any[];
  };
  editable?: boolean;
  onGeometryChange?: (geometry: any) => void;
  center?: [number, number];
  zoom?: number;
};

const MapComponent: React.FC<MapComponentProps> = ({
  geometry,
  editable = false,
  onGeometryChange,
  center = [-13.2344, 8.4556], // Default center (Sierra Leone)
  zoom = 15,
}) => {
  const { t } = useTranslation('common');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<any>(null);
  const [mapMode, setMapMode] = useState<'satellite' | 'standard' | 'terrain'>('standard');
  const [isGpsTracking, setIsGpsTracking] = useState(false);
  const [gpsMarker, setGpsMarker] = useState<mapboxgl.Marker | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  
  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    
    // Initialize Mapbox map
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center,
      zoom
    });
    
    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Add scale
    map.addControl(new mapboxgl.ScaleControl({
      maxWidth: 100,
      unit: 'metric'
    }), 'bottom-right');
    
    // If editable, add drawing controls
    if (editable) {
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true
        },
        defaultMode: 'simple_select',
        styles: [
          // Base styles
          {
            'id': 'gl-draw-polygon-fill-inactive',
            'type': 'fill',
            'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
            'paint': {
              'fill-color': '#3bb2d0',
              'fill-outline-color': '#3bb2d0',
              'fill-opacity': 0.3
            }
          },
          {
            'id': 'gl-draw-polygon-fill-active',
            'type': 'fill',
            'filter': ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
            'paint': {
              'fill-color': '#1e88e5',
              'fill-outline-color': '#1e88e5',
              'fill-opacity': 0.4
            }
          },
          {
            'id': 'gl-draw-polygon-stroke-inactive',
            'type': 'line',
            'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
            'layout': {
              'line-cap': 'round',
              'line-join': 'round'
            },
            'paint': {
              'line-color': '#3bb2d0',
              'line-width': 2
            }
          },
          {
            'id': 'gl-draw-polygon-stroke-active',
            'type': 'line',
            'filter': ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
            'layout': {
              'line-cap': 'round',
              'line-join': 'round'
            },
            'paint': {
              'line-color': '#1e88e5',
              'line-width': 3
            }
          },
          // Vertex points
          {
            'id': 'gl-draw-polygon-and-line-vertex-inactive',
            'type': 'circle',
            'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
            'paint': {
              'circle-radius': 5,
              'circle-color': '#fff',
              'circle-stroke-color': '#3bb2d0',
              'circle-stroke-width': 2
            }
          },
          {
            'id': 'gl-draw-polygon-and-line-vertex-active',
            'type': 'circle',
            'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['==', 'active', 'true']],
            'paint': {
              'circle-radius': 6,
              'circle-color': '#fff',
              'circle-stroke-color': '#1e88e5',
              'circle-stroke-width': 3
            }
          }
        ]
      });
      
      map.addControl(draw);
      drawRef.current = draw;
      
      // Handle draw events
      map.on('draw.create', updateGeometry);
      map.on('draw.update', updateGeometry);
      map.on('draw.delete', updateGeometry);
    }
    
    // Save map reference
    mapRef.current = map;
    
    // Wait for map to load before adding data
    map.on('load', () => {
      // Add existing geometry if provided
      if (geometry) {
        addGeometryToMap(geometry);
      }
    });
    
    // Cleanup function
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Empty dependency array to initialize once
  
  // Update the map when geometry changes
  useEffect(() => {
    if (!mapRef.current || !geometry) return;
    
    // Add or update geometry on the map
    addGeometryToMap(geometry);
  }, [geometry]);
  
  // Update map style when mapMode changes
  useEffect(() => {
    if (!mapRef.current) return;
    
    const styleUrl = mapMode === 'satellite' 
      ? 'mapbox://styles/mapbox/satellite-v9' 
      : mapMode === 'terrain' 
        ? 'mapbox://styles/mapbox/outdoors-v11' 
        : 'mapbox://styles/mapbox/streets-v11';
    
    mapRef.current.setStyle(styleUrl);
  }, [mapMode]);
  
  // Add geometry to map
  const addGeometryToMap = (geom: any) => {
    if (!mapRef.current) return;
    
    const map = mapRef.current;
    
    // Check if source already exists
    const sourceId = 'boundary-source';
    const layerId = 'boundary-layer';
    const outlineLayerId = 'boundary-outline-layer';
    
    // Remove existing layers and source if they exist
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    
    // Add new source and layers
    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: geom,
        properties: {}
      }
    });
    
    // Add fill layer
    map.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': '#3bb2d0',
        'fill-opacity': 0.3
      }
    });
    
    // Add outline layer
    map.addLayer({
      id: outlineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': '#3bb2d0',
        'line-width': 2
      }
    });
    
    // If using Draw and this is an initial load, add to Draw as well
    if (editable && drawRef.current) {
      // First clear any existing features
      drawRef.current.deleteAll();
      
      // Add the geometry as a feature
      drawRef.current.add({
        type: 'Feature',
        geometry: geom,
        properties: {}
      });
    }
    
    // Fit map to geometry bounds
    if (geom.coordinates && geom.coordinates.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      if (geom.type === 'Polygon') {
        geom.coordinates[0].forEach((coord: number[]) => {
          bounds.extend([coord[0], coord[1]]);
        });
      }
      map.fitBounds(bounds, { padding: 50 });
    }
  };
  
  // Update geometry when drawing changes
  const updateGeometry = () => {
    if (!drawRef.current || !onGeometryChange) return;
    
    const data = drawRef.current.getAll();
    if (data.features.length > 0) {
      const geometry = data.features[0].geometry;
      onGeometryChange(geometry);
    } else {
      onGeometryChange(null);
    }
  };
  
  // Change map style based on mapMode
  const changeMapStyle = (mode: 'satellite' | 'standard' | 'terrain') => {
    setMapMode(mode);
  };
  
  // Toggle GPS tracking
  const toggleGps = () => {
    if (isGpsTracking) {
      // Stop tracking
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      
      // Remove marker
      if (gpsMarker) {
        gpsMarker.remove();
        setGpsMarker(null);
      }
      
      setIsGpsTracking(false);
    } else {
      // Start tracking
      if (!navigator.geolocation) {
        alert(t('map.gps_not_available', 'Geolocation is not available in your browser.'));
        return;
      }
      
      // Create marker element
      const markerElement = document.createElement('div');
      markerElement.className = 'gps-marker';
      markerElement.style.width = '20px';
      markerElement.style.height = '20px';
      markerElement.style.borderRadius = '50%';
      markerElement.style.backgroundColor = '#1e88e5';
      markerElement.style.border = '3px solid white';
      markerElement.style.boxShadow = '0 0 0 2px rgba(0,0,0,0.1)';
      
      // Add accuracy circle element
      const accuracyElement = document.createElement('div');
      accuracyElement.className = 'accuracy-circle';
      accuracyElement.style.borderRadius = '50%';
      accuracyElement.style.backgroundColor = 'rgba(30, 136, 229, 0.15)';
      accuracyElement.style.border = '1px solid rgba(30, 136, 229, 0.3)';
      
      // Create new marker
      const newMarker = new mapboxgl.Marker({
        element: markerElement,
        anchor: 'center'
      });
      
      // Set up the position watching
      const id = navigator.geolocation.watchPosition((position) => {
        const { latitude, longitude, accuracy } = position.coords;
        
        if (mapRef.current) {
          // Update marker position
          newMarker.setLngLat([longitude, latitude]).addTo(mapRef.current);
          
          // Update accuracy circle size
          // 1 meter = approximately 0.00001 degrees at the equator
          // This is a rough approximation, in reality it depends on the latitude
          const map = mapRef.current;
          const zoom = map.getZoom();
          const accuracyPixels = accuracy / (0.00001 * Math.pow(2, zoom - 1));
          
          // Update accuracy circle size
          accuracyElement.style.width = `${accuracyPixels * 2}px`;
          accuracyElement.style.height = `${accuracyPixels * 2}px`;
          
          // Center map on user position
          map.flyTo({
            center: [longitude, latitude],
            zoom: Math.max(map.getZoom(), 17) // Ensure we're zoomed in enough
          });
        }
      }, (error) => {
        console.error('Geolocation error:', error);
        alert(t('map.gps_error', 'Error getting your location. Please check your device settings.'));
      }, {
        enableHighAccuracy: true,
        maximumAge: 5000, // 5 seconds
        timeout: 10000 // 10 seconds
      });
      
      setWatchId(id);
      setGpsMarker(newMarker);
      setIsGpsTracking(true);
    }
  };
  
  // Function to handle direct drawing button click
  const startDrawing = () => {
    if (drawRef.current) {
      drawRef.current.changeMode('draw_polygon');
    }
  };
  
  return (
    <div className="h-full relative">
      <div ref={mapContainerRef} className="h-full w-full bg-gray-100"></div>
      
      {/* Map style controls */}
      <div className="absolute bottom-2 left-2 bg-white rounded shadow p-2 z-10">
        <div className="flex space-x-2">
          <button
            className={`px-2 py-1 text-xs rounded ${mapMode === 'standard' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}
            onClick={() => changeMapStyle('standard')}
          >
            {t('map.standard')}
          </button>
          <button
            className={`px-2 py-1 text-xs rounded ${mapMode === 'satellite' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}
            onClick={() => changeMapStyle('satellite')}
          >
            {t('map.satellite')}
          </button>
          <button
            className={`px-2 py-1 text-xs rounded ${mapMode === 'terrain' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}
            onClick={() => changeMapStyle('terrain')}
          >
            {t('map.terrain')}
          </button>
        </div>
      </div>
      
      {/* Drawing tools */}
      {editable && (
        <div className="absolute top-2 left-2 bg-white rounded shadow p-2 z-10">
          <div className="flex flex-col space-y-2">
            <button
              className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-sm"
              title={t('map.draw')}
              onClick={startDrawing}
            >
              {t('map.draw')}
            </button>
            <button
              className={`p-2 ${isGpsTracking ? 'bg-red-100 hover:bg-red-200 text-red-800' : 'bg-green-100 hover:bg-green-200 text-green-800'} rounded text-sm`}
              title={isGpsTracking ? t('map.stop_gps') : t('map.gps')}
              onClick={toggleGps}
            >
              {isGpsTracking ? t('map.stop_gps') : t('map.gps')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;
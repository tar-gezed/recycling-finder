<template>
  <div class="map-container">
    <!-- Top Navigation for Filters -->
    <div class="top-nav-container">
      <div class="top-nav">
        <button
          v-for="filter in availableFilters"
          :key="filter.id"
          class="filter-chip"
          :class="{ active: activeFilters.includes(filter.id) }"
          @click="toggleFilter(filter.id)"
        >
          <svg-icon type="mdi" :path="filter.icon" class="chip-icon"></svg-icon>
          {{ filter.label }}
        </button>
      </div>
    </div>

    <l-map
      ref="mapLeaflet"
      v-model="mapState.zoom"
      v-model:zoom="mapState.zoom"
      @update:bounds="boundsUpdated"
      @ready="onLoad"
      :options="{ zoomControl: false }"
    >
      <l-tile-layer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        layer-type="base"
        name="OpenStreetMap"
      ></l-tile-layer>
      
      <!-- Locate Me Button is moved to absolute positioning outside leaflet controls -->

      <l-marker
        :lat-lng="[mapState.latitude, mapState.longitude]"
        :icon="userIcon"
      />

      <l-circle
        :lat-lng="[mapState.latitude, mapState.longitude]"
        :radius="mapState.accuracy"
        :fill="true"
      />


    </l-map>

    <!-- Bottom Sheet for Mobile -->
    <BottomSheet
      :visible="showBottomSheet"
      :marker="selectedMarker"
      :userLocation="{ lat: mapState.latitude, lon: mapState.longitude }"
      @close="showBottomSheet = false"
    />

    <!-- Absolute Locate Me Button -->
    <button
      @click="centerOnUser"
      class="locate-button"
      title="Me localiser"
    >
      <svg-icon type="mdi" :path="mdiCrosshairsGps"></svg-icon>
    </button>

  </div>
  <transition name="fade">
    <div class="top-progress-bar" v-show="loadingMarkers">
      <div class="progress-bar-value"></div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import {
  LMap,
  LTileLayer,
  LMarker,
  LCircle,
  LPopup,
} from "@vue-leaflet/vue-leaflet";
import "leaflet/dist/leaflet.css";
import { watch, ref, reactive, computed, onMounted, onUnmounted, nextTick } from "vue";
import type { Ref } from "vue";
import debounce from "lodash/debounce";
import OverpassApi, {
  type OverpassElement,
  type OverpassTags,
} from "../services/overpass-api";
import L, { divIcon, type Map as LeafletMap } from "leaflet";
import BottomSheet from "./BottomSheet.vue";
import { useToast } from "vue-toastification";
import SvgIcon from "@jamescoyle/vue-icon";
import { 
  mdiCrosshairsGps, 
  mdiGlassWine, 
  mdiNewspaper, 
  mdiBottleSoda, 
  mdiTshirtCrew, 
  mdiBattery 
} from "@mdi/js";
import { recyclingKeyMappings } from "../services/recycling-translations";

const mapLeaflet = ref(null);
const checkedOptions: Ref<string[]> = ref([
  "recycling_type_container",
  "recycling_type_centre",
]);

const loadingMarkers = ref(false);
const showCurrentLocation = ref(false);

const isMobile = ref(false);
const showBottomSheet = ref(false);
const selectedMarker = ref<OverpassElement | null>(null);

// LayerGroup natif Leaflet pour les marqueurs de recyclage.
// On bypasse le v-for de vue-leaflet qui est buggé avec la réactivité.
const markersLayerGroup = L.layerGroup();

const availableFilters = [
  { id: 'glass', keys: ['recycling:glass', 'recycling:glass_bottles'], label: 'Verre', icon: mdiGlassWine },
  { id: 'paper', keys: ['recycling:paper', 'recycling:cardboard'], label: 'Papier', icon: mdiNewspaper },
  { id: 'plastic', keys: ['recycling:plastic', 'recycling:plastic_packaging'], label: 'Plastique', icon: mdiBottleSoda },
  { id: 'clothes', keys: ['recycling:clothes', 'recycling:shoes'], label: 'Vêtements', icon: mdiTshirtCrew },
  { id: 'batteries', keys: ['recycling:batteries'], label: 'Batteries', icon: mdiBattery }
];
const activeFilters = ref<string[]>([]);

const toggleFilter = (id: string) => {
  if (activeFilters.value.includes(id)) {
    activeFilters.value = activeFilters.value.filter(f => f !== id);
  } else {
    activeFilters.value = [...activeFilters.value, id];
  }
};

const userIcon = divIcon({
  html: `
    <svg viewBox="0 0 10 10" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));">
      <circle cx="5" cy="5" r="4" fill="#fff"/>
      <circle cx="5" cy="5" r="2" fill="#059669">
        <animate attributeName="r" begin="0s" dur="3s" repeatCount="indefinite" values="1.5;3;1.5"/>
      </circle>
    </svg>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const getMarkerColor = (tags: OverpassTags) => {
  if (!tags) return '#374151'; // neutral gray
  
  const hasGlass = tags['recycling:glass'] === 'yes' || tags['recycling:glass_bottles'] === 'yes';
  const hasPaper = tags['recycling:paper'] === 'yes' || tags['recycling:cardboard'] === 'yes';
  const hasPlastic = tags['recycling:plastic'] === 'yes' || tags['recycling:plastic_packaging'] === 'yes';
  const hasClothes = tags['recycling:clothes'] === 'yes' || tags['recycling:shoes'] === 'yes';
  
  const typesCount = [hasGlass, hasPaper, hasPlastic, hasClothes].filter(Boolean).length;
  
  if (typesCount > 1) return '#374151'; // Mixed -> Neutral
  if (hasGlass) return '#059669'; // Emerald
  if (hasPaper) return '#2563eb'; // Blue
  if (hasPlastic) return '#ca8a04'; // Yellow
  if (hasClothes) return '#db2777'; // Pink
  
  return '#6b7280'; // Default Neutral (Gris) au lieu du Vert pour ne pas confondre avec le Verre
};

const getMarkerIcon = (tags: OverpassTags) => {
  const color = getMarkerColor(tags);
  return divIcon({
    html: `
      <svg viewBox="0 0 24 24" style="width: 36px; height: 36px; filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.2));">
        <path fill="${color}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        <circle cx="12" cy="9.5" r="2.5" fill="white"/>
      </svg>
    `,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  });
};

const mapState = reactive({
  zoom: 16,
  latitude: 45,
  longitude: 12,
  accuracy: 100,
  userCoords: {} as GeolocationPosition,
  bounds: null,
});

const recyclingMarkers = ref<OverpassElement[]>([]);

const getMap = () => (mapLeaflet.value as any)?.leafletObject as LeafletMap | undefined;

const toast = useToast();

/**
 * Calcule les marqueurs filtrés selon les filtres actifs.
 * Si aucun filtre actif -> tous les marqueurs.
 */
const filteredMarkers = computed(() => {
  if (activeFilters.value.length === 0) {
    return recyclingMarkers.value;
  }
  
  const activeKeys = availableFilters
    .filter(f => activeFilters.value.includes(f.id))
    .flatMap(f => f.keys);

  return recyclingMarkers.value.filter(m => {
    return activeKeys.some(key => m.tags[key] === 'yes');
  });
});

/**
 * Met à jour le LayerGroup Leaflet natif en fonction de filteredMarkers.
 * C'est la méthode impérative qui contourne les bugs de réactivité de vue-leaflet.
 */
const renderMarkersOnMap = (markers: OverpassElement[]) => {
  markersLayerGroup.clearLayers();
  markers.forEach(marker => {
    const leafletMarker = L.marker([marker.lat, marker.lon], {
      icon: getMarkerIcon(marker.tags),
    });
    
    // Popup desktop
    if (!isMobile.value && marker.tags) {
      const materials = getRecyclingMaterials(marker.tags);
      const chipsHtml = materials.length > 0
        ? `<div class="popup-chips">${materials.map(m => `<span class="popup-chip">${m}</span>`).join('')}</div>`
        : '';
      const distanceHtml = getDistanceText(marker)
        ? `<p class="popup-distance">${getDistanceText(marker)}</p>`
        : '';
      const operatorHtml = marker.tags.operator
        ? `<p><strong>Opérateur :</strong> ${marker.tags.operator}</p>`
        : '';
      const hoursHtml = marker.tags.opening_hours
        ? `<p><strong>Horaires :</strong> ${marker.tags.opening_hours}</p>`
        : '';
      const additionalHtml = (operatorHtml || hoursHtml)
        ? `<div class="popup-additional-info">${operatorHtml}${hoursHtml}</div>`
        : '';

      leafletMarker.bindPopup(`
        <div class="popup-content">
          <h4>${marker.tags.name || 'Conteneur de Recyclage'}</h4>
          ${distanceHtml}
          ${chipsHtml}
          ${additionalHtml}
          <a href="https://www.google.com/maps/dir/?api=1&destination=${marker.lat},${marker.lon}"
             target="_blank" class="direction-button">
            <svg style="width:16px;height:16px;margin-right:6px;vertical-align:middle" viewBox="0 0 24 24">
              <path fill="currentColor" d="M14 20L12.5 18.5L17 14H6.5V20H4.5V12H17L12.5 7.5L14 6L21 13L14 20Z"/>
            </svg>
            <span style="vertical-align:middle">Y aller</span>
          </a>
        </div>
      `, { offset: [0, -24] });
    }
    
    // Click sur mobile -> BottomSheet
    leafletMarker.on('click', () => onMarkerClick(marker));
    
    markersLayerGroup.addLayer(leafletMarker);
  });
};

// Surveiller filteredMarkers et mettre à jour la carte impérativement.
// immediate: true permet de déclencher le rendu dès que les données sont prêtes,
// même si la carte n'est pas encore montée (le LayerGroup est attachi plus tard).
watch(filteredMarkers, (newMarkers) => {
  renderMarkersOnMap(newMarkers);
}, { immediate: true });

const getDistanceText = (marker: OverpassElement) => {
  if (!mapState.latitude || !mapState.longitude) return '';
  const userLatLng = L.latLng(mapState.latitude, mapState.longitude);
  const markerLatLng = L.latLng(marker.lat, marker.lon);
  const dist = userLatLng.distanceTo(markerLatLng);
  if (dist > 1000) {
    return `À ${(dist / 1000).toFixed(1)} km`;
  } else {
    return `À ${Math.round(dist)} m`;
  }
};

const checkMobile = () => {
  isMobile.value = window.matchMedia('(max-width: 768px)').matches;
};

onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
});

let geoWatchId: number | null = null;

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
  if (geoWatchId !== null && window.navigator.geolocation) {
    window.navigator.geolocation.clearWatch(geoWatchId);
  }
});

const getRecyclingMaterials = (tags: OverpassTags) => {
  return Object.keys(tags)
    .filter((key) => key.startsWith("recycling:") && tags[key] === "yes")
    .map((key) => recyclingKeyMappings[key] || key.replace('recycling:', ''))
    .filter((value): value is string => !!value);
};

const onMarkerClick = (marker: OverpassElement) => {
  if (isMobile.value) {
    selectedMarker.value = marker;
    showBottomSheet.value = true;
  }
};

const centerOnUser = () => {
  if (window.navigator.geolocation) {
    window.navigator.geolocation.getCurrentPosition(
      (position) => {
        const latLon = L.latLng(
          position.coords.latitude,
          position.coords.longitude
        );
        getMap()?.setView(latLon, 16);
        updatePosition(position);
      },
      errorGetLocation,
      { enableHighAccuracy: true }
    );
  } else {
    errorAuthorizeLocation();
  }
};

const onLoad = (event: any) => {
  // Brancher le LayerGroup natif sur la carte Leaflet dès son initialisation
  const map = getMap();
  if (map) {
    markersLayerGroup.addTo(map);
  }

  if (window.navigator.geolocation) {
    window.navigator.geolocation.getCurrentPosition((position) => {
      const latLon = L.latLng(
        position.coords.latitude,
        position.coords.longitude
      );
      getMap()?.setView(latLon, mapState.zoom);
      updatePosition(position);
      const bounds = getMap()?.getBounds();
      if (bounds) {
        loadRecyclingMarkers(bounds);
      }
    }, errorGetLocation);

    geoWatchId = navigator.geolocation.watchPosition((position) => {
      updatePosition(position);
    });
  } else {
    errorAuthorizeLocation();
  }
};

const loadRecyclingMarkers = async (bounds: any) => {
  mapState.bounds = bounds;
  loadingMarkers.value = true;
  
  let wasCancelled = false;

  try {
    const newMarkers = await OverpassApi.searchRecyclingSpots(
      bounds,
      checkedOptions.value
    );
    
    // Si la requête a été annulée silencieusement
    if (newMarkers === null) {
      wasCancelled = true;
      return;
    }
    
    if (newMarkers.length === 0) {
      toast.info("Aucun point de recyclage trouvé dans cette zone.");
      recyclingMarkers.value = [];
    } else {
      recyclingMarkers.value = newMarkers;
    }
    
    // Forcer le rendu impératif immédiatement après la mise à jour des données.
    // Le watch sur filteredMarkers devrait normalement faire ça,
    // mais on appelle renderMarkersOnMap en sécurité pour garantir l'affichage.
    renderMarkersOnMap(filteredMarkers.value);
  } catch (error: any) {
    toast.error(error.message);
  } finally {
    if (!wasCancelled) {
      loadingMarkers.value = false;
    }
  }
};

const updatePosition = (position: GeolocationPosition) => {
  showCurrentLocation.value = true;
  mapState.latitude = position.coords.latitude;
  mapState.longitude = position.coords.longitude;
  mapState.accuracy = position.coords.accuracy;
};

const errorGetLocation = (error: GeolocationPositionError) => {
  toast.error(`Erreur de localisation: ${error?.message}`);
  console.error(error?.message, error?.code);
};

const errorAuthorizeLocation = () => {
  toast.error("La localisation n'est pas autorisée par votre navigateur.");
};

const boundsUpdated = debounce((bounds?: any) => {
  const b = bounds || getMap()?.getBounds();
  if (b) {
    loadRecyclingMarkers(b);
  }
}, 3000, {
  leading: true,
  trailing: true,
});

watch(checkedOptions, () => boundsUpdated());
</script>

<style scoped>
.map-container {
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
  position: relative;
}

.top-nav-container {
  position: absolute;
  top: 16px;
  left: 0;
  width: 100%;
  z-index: 1000;
  pointer-events: none; /* Let map clicks through if not on the nav itself */
}

.top-nav {
  display: flex;
  overflow-x: auto;
  padding: 0 16px 16px 16px;
  gap: 12px;
  pointer-events: auto; /* Re-enable pointer events for the nav items */
  /* Hide scrollbar */
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.top-nav::-webkit-scrollbar {
  display: none;
}

.filter-chip {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  background-color: var(--color-background);
  color: var(--color-heading);
  border: 1px solid #e5e7eb; /* gray-200 */
  padding: 8px 16px;
  border-radius: 9999px; /* Pill shape */
  font-size: 0.9rem;
  font-weight: 500;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.2s;
  outline: none;
}

.chip-icon {
  width: 18px;
  height: 18px;
  margin-right: 6px;
  color: var(--color-heading);
}

.filter-chip.active {
  background-color: var(--color-primary-light);
  color: var(--color-primary-dark);
  border-color: var(--color-primary-light);
}

.filter-chip.active .chip-icon {
  color: var(--color-primary-dark);
}

.locate-button {
  position: absolute;
  bottom: 24px;
  right: 16px;
  z-index: 1000;
  background-color: white;
  border: none;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s, background-color 0.2s;
}

.locate-button:active {
  transform: scale(0.95);
  background-color: #f3f4f6; /* gray-100 */
}

.locate-button svg {
  color: var(--color-primary);
  width: 24px;
  height: 24px;
}

.top-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background-color: var(--color-primary-light, #d1fae5); /* Fallback vert clair */
  z-index: 1001;
  overflow: hidden;
}

.progress-bar-value {
  width: 100%;
  height: 100%;
  background-color: var(--color-primary, #059669); /* Fallback vert foncé */
  animation: indeterminateAnimation 1.5s infinite linear;
  transform-origin: 0% 50%;
}

@keyframes indeterminateAnimation {
  0% {
    transform: translateX(0) scaleX(0);
  }
  40% {
    transform: translateX(0) scaleX(0.4);
  }
  100% {
    transform: translateX(100%) scaleX(0.5);
  }
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

<style>
/* Leaflet Popup overrides and custom styling (Desktop Mode) */
.leaflet-popup {
  margin-bottom: 12px;
}

.leaflet-popup-content-wrapper {
  background-color: var(--color-background) !important;
  color: var(--color-text) !important;
  border-radius: 20px !important;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
  border: 1px solid var(--color-border) !important;
  padding: 16px !important;
}

.leaflet-popup-content {
  margin: 0 !important;
  width: 250px !important;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  line-height: 1.5 !important;
}

.leaflet-popup-tip {
  background-color: var(--color-background) !important;
  border: 1px solid var(--color-border) !important;
  box-shadow: none !important;
}

.leaflet-popup-close-button {
  color: var(--color-text) !important;
  font-size: 20px !important;
  font-weight: 300 !important;
  top: 12px !important;
  right: 12px !important;
  width: 24px !important;
  height: 24px !important;
  line-height: 24px !important;
  background: transparent !important;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: background-color 0.2s, color 0.2s !important;
}

.leaflet-popup-close-button:hover {
  background-color: var(--color-background-mute) !important;
  color: var(--color-heading) !important;
}

/* Custom classes inside the leaflet popup */
.popup-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.popup-content h4 {
  margin: 0 !important;
  font-size: 1.25rem !important;
  font-weight: 700 !important;
  color: var(--color-heading) !important;
  line-height: 1.3 !important;
}

.popup-distance {
  margin: -6px 0 0 0 !important;
  font-size: 0.9rem !important;
  color: #6b7280 !important; /* gray-500 */
}

.popup-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 4px 0 !important;
}

.popup-chip {
  background-color: var(--color-primary-light) !important;
  color: var(--color-primary-dark) !important;
  padding: 6px 12px !important;
  border-radius: 9999px !important;
  font-size: 0.8rem !important;
  font-weight: 500 !important;
  white-space: nowrap;
}

.popup-additional-info {
  margin: 0 !important;
  font-size: 0.9rem !important;
  color: var(--color-text) !important;
  border-top: 1px solid var(--color-border) !important;
  padding-top: 10px !important;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.popup-additional-info p {
  margin: 0 !important;
}

.direction-button {
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  width: 100% !important;
  padding: 12px !important;
  background-color: #2563eb !important; /* blue-600 */
  color: white !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 600 !important;
  font-size: 0.95rem !important;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25) !important;
  transition: background-color 0.2s, transform 0.1s !important;
  margin-top: 4px !important;
}

.direction-button:hover {
  background-color: #1d4ed8 !important; /* blue-700 */
  text-decoration: none !important;
}

.direction-button:active {
  transform: scale(0.98) !important;
}
</style>

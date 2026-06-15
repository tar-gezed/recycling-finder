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

      <l-marker
        v-for="marker in filteredMarkers"
        :key="marker.id"
        :lat-lng="[marker.lat, marker.lon]"
        :icon="getMarkerIcon(marker.tags)"
        @click="onMarkerClick(marker)"
      >
        <l-popup v-if="!isMobile && marker.tags" :options="{ offset: [0, -24] }">
          <div class="popup-content">
            <h4>{{ marker.tags.name || 'Conteneur de Recyclage' }}</h4>
            <p class="popup-distance" v-if="getDistanceText(marker)">{{ getDistanceText(marker) }}</p>

            <div v-if="getRecyclingMaterials(marker.tags).length > 0" class="popup-chips">
              <span
                v-for="material in getRecyclingMaterials(marker.tags)"
                :key="material"
                class="popup-chip"
              >
                {{ material }}
              </span>
            </div>

            <div v-if="marker.tags.opening_hours || marker.tags.operator" class="popup-additional-info">
              <p v-if="marker.tags.operator"><strong>Opérateur :</strong> {{ marker.tags.operator }}</p>
              <p v-if="marker.tags.opening_hours"><strong>Horaires :</strong> {{ marker.tags.opening_hours }}</p>
            </div>

            <a
              :href="`https://www.google.com/maps/dir/?api=1&destination=${marker.lat},${marker.lon}`"
              target="_blank"
              class="direction-button"
            >
              <svg style="width:16px;height:16px;margin-right:6px;vertical-align:middle" viewBox="0 0 24 24">
                <path fill="currentColor" d="M14 20L12.5 18.5L17 14H6.5V20H4.5V12H17L12.5 7.5L14 6L21 13L14 20Z"/>
              </svg>
              <span style="vertical-align:middle">Y aller</span>
            </a>
          </div>
        </l-popup>
      </l-marker>
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
  <transition name="spinner">
    <div class="loading" v-show="loadingMarkers">
      <div class="loading-text">Chargement des données...</div>
      <spinner-component></spinner-component>
    </div>
  </transition>
</template>

<script setup lang="ts">
import {
  LMap,
  LTileLayer,
  LMarker,
  LCircle,
  LControl,
  LPopup,
} from "@vue-leaflet/vue-leaflet";
import "leaflet/dist/leaflet.css";
import { watch, ref, reactive, computed, onMounted, onUnmounted } from "vue";
import type { Ref } from "vue";
import { debounce } from "lodash";
import OverpassApi, {
  type OverpassElement,
  type OverpassTags,
} from "../services/overpass-api";
import L, { divIcon } from "leaflet";
import SpinnerComponent from "./SpinnerComponent.vue";
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

const availableFilters = [
  { id: 'glass', keys: ['recycling:glass', 'recycling:glass_bottles'], label: 'Verre', icon: mdiGlassWine },
  { id: 'paper', keys: ['recycling:paper', 'recycling:cardboard'], label: 'Papier', icon: mdiNewspaper },
  { id: 'plastic', keys: ['recycling:plastic', 'recycling:plastic_packaging'], label: 'Plastique', icon: mdiBottleSoda },
  { id: 'clothes', keys: ['recycling:clothes', 'recycling:shoes'], label: 'Vêtements', icon: mdiTshirtCrew },
  { id: 'batteries', keys: ['recycling:batteries'], label: 'Batteries', icon: mdiBattery }
];
const activeFilters = ref<string[]>([]);

const toggleFilter = (id: string) => {
  const index = activeFilters.value.indexOf(id);
  if (index > -1) {
    activeFilters.value.splice(index, 1);
  } else {
    activeFilters.value.push(id);
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
  
  return '#059669'; // Default Primary
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
  map: {},
  recyclingMarkers: [] as OverpassElement[],
});

const toast = useToast();

const filteredMarkers = computed(() => {
  if (activeFilters.value.length === 0) return mapState.recyclingMarkers;
  
  const activeKeys = availableFilters
    .filter(f => activeFilters.value.includes(f.id))
    .flatMap(f => f.keys);

  return mapState.recyclingMarkers.filter(m => {
    return activeKeys.some(key => m.tags[key] === 'yes');
  });
});

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

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
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
        (mapState.map as any).setView(latLon, 16);
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
  mapState.map = (mapLeaflet as any).value.leafletObject;
  if (window.navigator.geolocation) {
    window.navigator.geolocation.getCurrentPosition((position) => {
      const latLon = L.latLng(
        position.coords.latitude,
        position.coords.longitude
      );
      (mapState.map as any).setView(latLon, mapState.zoom);
      updatePosition(position);
      loadRecyclingMarkers((mapState.map as any).getBounds());
    }, errorGetLocation);

    navigator.geolocation.watchPosition((position) => {
      updatePosition(position);
    });
  } else {
    errorAuthorizeLocation();
  }
};

const loadRecyclingMarkers = async (bounds: any) => {
  mapState.bounds = bounds;
  loadingMarkers.value = true;
  const newMarkers = await OverpassApi.searchRecyclingSpots(
    bounds,
    checkedOptions
  );
  mapState.recyclingMarkers =
    newMarkers.length > 0 ? newMarkers : mapState.recyclingMarkers;
  loadingMarkers.value = false;
};

const updatePosition = (position: GeolocationPosition) => {
  showCurrentLocation.value = true;
  mapState.latitude = position.coords.latitude;
  mapState.longitude = position.coords.longitude;
  mapState.accuracy = position.coords.accuracy;
};

const errorGetLocation = (error: GeolocationPositionError) => {
  // toast.error(error?.message);
  console.error(error?.message, error?.code);
};

const errorAuthorizeLocation = () => {
  toast.error("Error Location Not Authorized");
};

const boundsUpdated = debounce(loadRecyclingMarkers, 3000, {
  leading: true,
  trailing: true,
});

watch(checkedOptions, () => boundsUpdated((mapState.map as any).getBounds()));
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

.popup-distance {
  color: #6b7280;
  font-size: 0.85rem;
  margin-top: -8px;
  margin-bottom: 12px;
}

.popup-additional-info {
  font-size: 0.85rem;
  color: #374151;
  margin-bottom: 12px;
}

.popup-additional-info p {
  margin: 2px 0;
}

.loading {
  position: absolute;
  bottom: 0;
  z-index: 999;
  left: 50%;
  transform: translate(-50%, 0);
  background-color: var(--color-primary);
  border-radius: 15px 15px 0px 0px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 24px;
  box-shadow: 0 -4px 15px rgba(0, 0, 0, 0.2);
}

.loading-text {
  text-align: center;
  color: #fff;
  font-weight: 500;
}

.popup-content {
  padding: 4px;
  min-width: 200px;
}

.popup-content h4 {
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-heading);
}

.popup-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}

.popup-chip {
  background-color: var(--color-primary-light);
  color: var(--color-primary-dark);
  padding: 4px 8px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.direction-button {
  display: block;
  width: 100%;
  padding: 10px;
  background-color: #2563eb; /* blue-600 */
  color: white !important;
  border-radius: 8px;
  text-decoration: none;
  text-align: center;
  font-weight: 600;
  transition: background-color 0.3s;
}

.direction-button:hover {
  background-color: #1d4ed8;
}

/* Transitions */
.spinner-enter-active,
.spinner-leave-active,
.spinner-enter-to {
  transition: all 0.3s;
}
.spinner-enter,
.spinner-leave-to {
  transition: all 0.3s;
  transform: translate(-50%, 100%);
}

/* Leaflet Overrides */
:deep(.leaflet-popup-content-wrapper) {
  border-radius: 16px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
}
</style>

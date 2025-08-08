<template>
  <div class="map-container">
    <l-map
      ref="mapLeaflet"
      v-model="mapState.zoom"
      v-model:zoom="mapState.zoom"
      @update:bounds="boundsUpdated"
      @ready="onLoad"
    >
      <!-- :center="[mapState.latitude, mapState.longitude]" -->
      <l-tile-layer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        layer-type="base"
        name="OpenStreetMap"
      ></l-tile-layer>
      <l-control position="topright">
        <div class="options-panel">
          <a
            class="toggle-menu"
            @click="showOption = !showOption"
            :class="{ active: showOption }"
          >
            <i></i>
            <i></i>
            <i></i>
          </a>

          <transition name="expand">
            <div class="options" v-show="showOption">
              <ul class="options-list">
                <li class="options-item">
                  <input
                    type="checkbox"
                    id="recycling_type_container"
                    value="recycling_type_container"
                    v-model="checkedOptions"
                  />
                  <label for="recycling_type_container">Container</label>
                </li>
                <li class="options-item">
                  <input
                    type="checkbox"
                    id="recycling_type_centre"
                    value="recycling_type_centre"
                    v-model="checkedOptions"
                  />
                  <label for="recycling_type_centre">Recycling centre</label>
                </li>
              </ul>
            </div>
          </transition>
        </div>
      </l-control>

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
        v-for="marker in mapState?.recyclingMarkers"
        :key="marker.id"
        :lat-lng="[marker.lat, marker.lon]"
      >
        <l-popup v-if="marker.tags">
          <ul>
            <li v-if="marker.tags.name">
              {{ marker.tags.name }}
            </li>
            <li v-if="marker.tags.recycling_type">
              Type: {{ marker.tags.recycling_type }}
            </li>
            <li v-if="getRecyclingMaterials(marker.tags).length > 0">
              Materials: {{ getRecyclingMaterials(marker.tags).join(', ') }}
            </li>
          </ul>
          <a
            :href="`https://www.google.com/maps/search/?api=1&query=${marker.lat},${marker.lon}`"
            target="_blank"
            >>Open on maps</a
          >
        </l-popup>
      </l-marker>
    </l-map>
  </div>
  <transition name="spinner">
    <div class="loading" v-show="loadingMarkers">
      <div class="loading-text">Loading data, please wait...</div>
      <spinner-component></spinner-component>
    </div>
  </transition>
</template>

<style scoped>
.loading {
  position: absolute;
  bottom: 0;
  z-index: 999;
  left: 50%;
  transform: translate(-50%, 0);
  background-color: #202124;
  border-radius: 15px 15px 0px 0px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 12px 0;
}

.loading-text {
  text-align: center;
}

.map-container {
  display: flex;
  flex: 1;
}

.options-panel {
  display: flex;
  background-color: white;
  color: black;
  min-width: 50px;
  transition: all 0.3s;
}

.options {
  order: 1;
}

.options-list {
  list-style-type: none;
  padding: 12px;
  font-size: medium;
}

.options-item input {
  margin-right: 12px;
}

.toggle-menu {
  width: 30px;
  height: 50px;
  display: block;
  position: relative;
  margin-left: auto;
  margin-right: 9px;
  z-index: 1000;
  order: 2;
}

.toggle-menu i {
  position: absolute;
  display: block;
  height: 2px;
  background: #0094fc;
  width: 30px;
  -webkit-transition: all 0.3s;
  transition: all 0.3s;
}

.toggle-menu i:nth-child(1) {
  top: 16px;
}

.toggle-menu i:nth-child(2) {
  top: 24px;
}

.toggle-menu i:nth-child(3) {
  top: 32px;
}

.toggle-menu.active i:nth-child(1) {
  top: 25px;
  -webkit-transform: rotateZ(45deg);
  transform: rotateZ(45deg);
}

.toggle-menu.active i:nth-child(2) {
  background: transparent;
}

.toggle-menu.active i:nth-child(3) {
  top: 25px;
  -webkit-transform: rotateZ(-45deg);
  transform: rotateZ(-45deg);
}

.expand-enter-active,
.expand-leave-active,
.expand-enter-to {
  transition: all 0.3s;
  max-height: 200px;
  max-width: 250px;
  overflow: hidden;
}
.expand-enter,
.expand-leave-to {
  transition: all 0.3s;
  max-height: 0;
  max-width: 0;
  opacity: 0;
}

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
</style>

<script setup lang="ts">
import {
  LMap,
  LIcon,
  LTileLayer,
  LMarker,
  LCircle,
  LControlLayers,
  LTooltip,
  LControl,
  LPopup,
  LPolyline,
  LPolygon,
  LRectangle,
} from "@vue-leaflet/vue-leaflet";
import "leaflet/dist/leaflet.css";
import { defineComponent, watch } from "vue";
import type { PropType } from "vue";
import axios from "axios";
import { debounce } from "lodash";
import OverpassApi, { type OverpassElement, type OverpassTags } from "../services/overpass-api";
import { ref, reactive } from "vue";
import { computed, type Ref } from "@vue/reactivity";
import L, { divIcon, icon } from "leaflet";
import SpinnerComponent from "./SpinnerComponent.vue";
import { useToast } from 'vue-toastification';

const mapLeaflet = ref(null);
const checkedOptions: Ref<string[]> = ref(["recycling_type_container", "recycling_type_centre"]);
const showOption = ref(false);
const showCurrentLocation = ref(false);
let loadingMarkers = ref(false);

const userIcon = divIcon({
  html: `
                <svg viewBox="0 0 10 10">
                  <circle cx="5" cy="5" r="4" fill="#fff"/>
                  <circle cx="5" cy="5" r="2" fill="#1981FB">
                    <animate attributeName="r" begin="0s" dur="5s" repeatCount="indefinite" values="1.5;3;1.5"/>
                  </circle>
                </svg>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [32 / 2, 32 / 2],
});

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

let iconWidth = 25;
let iconHeight = 40;
let watchLocationID = 0;

const iconUrl = computed(() => {
  return `https://placekitten.com/${iconWidth}/${iconHeight}`;
});

const iconSize = computed(() => {
  return [iconWidth, iconHeight];
});

const getRecyclingMaterials = (tags: OverpassTags) => {
  return Object.keys(tags)
    .filter((key) => key.startsWith("recycling:") && tags[key] === "yes")
    .map((key) => key.replace("recycling:", ""));
};

const log = (a: any) => {
  console.log(a);
};

const changeIcon = () => {
  console.log("toto", mapState.userCoords);
  mapState.latitude = 1;
  mapState.longitude = 1;
  iconWidth += 2;
  if (iconWidth > iconHeight) {
    iconWidth = Math.floor(iconHeight / 2);
  }
};

const onLoad = (event: any) => {
  console.log(event);
  mapState.map = (mapLeaflet as any).value.leafletObject;
  console.log((mapState.map as any).getBounds(), mapState.bounds);
  if (window.navigator.geolocation) {
    // Geolocation available
    window.navigator.geolocation.getCurrentPosition((position) => {
      console.log(position);
      const latLon = L.latLng(position.coords.latitude,  position.coords.longitude);
      (mapState.map as any).setView(latLon, mapState.zoom);
      updatePosition(position);
      loadRecyclingMarkers((mapState.map as any).getBounds());
    }, errorGetLocation);

    watchLocationID = navigator.geolocation.watchPosition((position) => {
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
  mapState.recyclingMarkers =  newMarkers.length > 0 ? newMarkers : mapState.recyclingMarkers;
  loadingMarkers.value = false;
};

const updatePosition = (position: GeolocationPosition) => {
  showCurrentLocation.value = true;
  mapState.latitude = position.coords.latitude;
  mapState.longitude = position.coords.longitude;
  mapState.accuracy = position.coords.accuracy;
};

const errorGetLocation = (error: GeolocationPositionError) => {
  toast.error(error?.message);
  console.error(error?.message, error?.code);
};

const errorAuthorizeLocation = () => {
  toast.error("Error Location Not Authorized");
};

const boundsUpdated = debounce(loadRecyclingMarkers, 3000, { 'leading': true, 'trailing': true });

watch(checkedOptions, () => boundsUpdated((mapState.map as any).getBounds()));
</script>

<template>
  <teleport to="body">
    <transition name="backdrop-fade">
      <div v-if="visible" class="backdrop" @click="close"></div>
    </transition>
    <transition name="slide-up">
      <div
        v-if="visible"
        class="bottom-sheet"
        role="dialog"
        aria-modal="true"
        ref="sheetRef"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
      >
        <div class="drag-handle-container" @click="close">
          <div class="drag-handle"></div>
        </div>

        <div class="sheet-content" v-if="marker">
          <h2 class="title">{{ title }}</h2>
          <p v-if="distanceText" class="distance">{{ distanceText }}</p>

          <div v-if="materials.length > 0" class="chips-container">
            <span v-for="mat in materials" :key="mat" class="chip">
              {{ mat }}
            </span>
          </div>

          <div v-if="marker.tags?.opening_hours || marker.tags?.operator" class="additional-info">
            <p v-if="marker.tags.operator"><strong>Opérateur :</strong> {{ marker.tags.operator }}</p>
            <p v-if="marker.tags.opening_hours"><strong>Horaires :</strong> {{ marker.tags.opening_hours }}</p>
          </div>

          <a :href="directionsUrl" target="_blank" rel="noopener noreferrer" class="directions-btn">
            <svg style="width:20px;height:20px;margin-right:8px;" viewBox="0 0 24 24">
              <path fill="currentColor" d="M14 20L12.5 18.5L17 14H6.5V20H4.5V12H17L12.5 7.5L14 6L21 13L14 20Z"/>
            </svg>
            Y aller
          </a>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import type { PropType } from 'vue';
import type { OverpassElement } from '../services/overpass-api';
import { recyclingKeyMappings } from '../services/recycling-translations';
import L from 'leaflet';

const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  },
  marker: {
    type: Object as PropType<OverpassElement | null>,
    default: null
  },
  userLocation: {
    type: Object as PropType<{ lat: number; lon: number } | null>,
    default: null
  }
});

const emit = defineEmits(['close']);
const sheetRef = ref<HTMLElement | null>(null);

// Swipe to close logic
let touchStartY = 0;
let touchCurrentY = 0;
const threshold = 100; // pixels to swipe down to close

const onTouchStart = (e: TouchEvent) => {
  touchStartY = e.touches[0].clientY;
};

const onTouchMove = (e: TouchEvent) => {
  touchCurrentY = e.touches[0].clientY;
  const diff = touchCurrentY - touchStartY;
  if (diff > 0 && sheetRef.value) {
    sheetRef.value.style.transform = `translateY(${diff}px)`;
  }
};

const onTouchEnd = () => {
  const diff = touchCurrentY - touchStartY;
  if (sheetRef.value) {
    sheetRef.value.style.transform = ''; // reset transform
  }
  if (diff > threshold) {
    close();
  }
};

const close = () => {
  emit('close');
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.visible) {
    close();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

watch(() => props.visible, (newVal) => {
  if (newVal) {
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  } else {
    document.body.style.overflow = '';
  }
});

const title = computed(() => {
  return props.marker?.tags?.name || 'Conteneur de Recyclage';
});

const materials = computed(() => {
  if (!props.marker || !props.marker.tags) return [];
  const tags = props.marker.tags;
  return Object.keys(tags)
    .filter(key => key.startsWith('recycling:') && tags[key] === 'yes')
    .map(key => recyclingKeyMappings[key] || key.replace('recycling:', ''))
    .filter(Boolean);
});

const distanceText = computed(() => {
  if (!props.userLocation || !props.marker) return null;
  const from = L.latLng(props.userLocation.lat, props.userLocation.lon);
  const to = L.latLng(props.marker.lat, props.marker.lon);
  const dist = from.distanceTo(to);
  if (dist > 1000) {
    return `À ${(dist / 1000).toFixed(1)} km`;
  }
  return `À ${Math.round(dist)} m`;
});

const directionsUrl = computed(() => {
  if (!props.marker) return '#';
  return `https://www.google.com/maps/dir/?api=1&destination=${props.marker.lat},${props.marker.lon}`;
});
</script>

<style scoped>
.backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 2000;
}

.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100vw;
  max-height: 90vh;
  background-color: var(--color-background);
  border-radius: 24px 24px 0 0;
  z-index: 2001;
  box-shadow: 0 -10px 25px -5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease-out;
}

.drag-handle-container {
  width: 100%;
  padding: 16px 0;
  display: flex;
  justify-content: center;
  cursor: grab;
}

.drag-handle-container:active {
  cursor: grabbing;
}

.drag-handle {
  width: 40px;
  height: 4px;
  background-color: #d1d5db; /* gray-300 */
  border-radius: 2px;
}

.sheet-content {
  padding: 0 24px 32px 24px;
  overflow-y: auto;
}

.title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-heading);
  margin-bottom: 4px;
}

.distance {
  font-size: 0.9rem;
  color: #6b7280; /* gray-500 */
  margin-bottom: 16px;
}

.chips-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}

.chip {
  background-color: var(--color-primary-light);
  color: var(--color-primary-dark);
  padding: 6px 12px;
  border-radius: 9999px; /* Pill shape */
  font-size: 0.85rem;
  font-weight: 500;
}

.additional-info {
  margin-bottom: 24px;
  font-size: 0.95rem;
  color: var(--color-text);
}

.additional-info p {
  margin-bottom: 4px;
}

.directions-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 14px;
  background-color: #2563eb; /* blue-600 */
  color: white !important;
  border-radius: 12px;
  text-decoration: none;
  font-weight: 600;
  font-size: 1rem;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  transition: background-color 0.2s;
}

.directions-btn:active {
  background-color: #1d4ed8; /* blue-700 */
}

/* Transitions */
.backdrop-fade-enter-active,
.backdrop-fade-leave-active {
  transition: opacity 0.3s;
}
.backdrop-fade-enter-from,
.backdrop-fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>

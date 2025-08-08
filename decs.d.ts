declare module "@vue-leaflet/vue-leaflet" {
  import type { DefineComponent } from "vue";
  export const LMap: DefineComponent;
  export const LIcon: DefineComponent;
  export const LTileLayer: DefineComponent;
  export const LMarker: DefineComponent;
  export const LCircle: DefineComponent;
  export const LControlLayers: DefineComponent;
  export const LControl: DefineComponent;
  export const LTooltip: DefineComponent;
  export const LPopup: DefineComponent;
  export const LPolyline: DefineComponent;
  export const LPolygon: DefineComponent;
  export const LRectangle: DefineComponent;
}

declare let SvgIcon: import("vue").DefineComponent<{
  type: {
    type: StringConstructor;
    default: string;
  };
  path: {
    type: StringConstructor;
    default: string;
  };
  size: {
    type: NumberConstructor;
    optional: boolean;
  };
  viewbox: {
    type: StringConstructor;
    optional: boolean;
  };
  flip: {
    type: StringConstructor;
    optional: boolean;
  };
  rotate: {
    type: StringConstructor;
    optional: boolean;
  };
}>;

declare module "@jamescoyle/vue-icon" {
  export default SvgIcon;
}

import axios from "axios";
import type { LatLng } from "leaflet";
import type { Ref } from 'vue';
import { useToast } from 'vue-toastification';


export type OverpassBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type OverpassElement = {
  id: number;
  lat: number;
  lon: number;
  tags: OverpassTags;
};

export type OverpassTags = {
  access?: "private" | "customers" | "restricted" | "permissive" | "yes";
  amenity?: "recycling";
  fee?: "yes" | "no";
  wheelchair?: "yes" | "no" | "limited";
  name?: string;
  indoor?: "no" | "yes";
  opening_hours?: string;
  image?: string;
  wikimedia_commons?: string;
  recycling_type?: 'center' | 'container';
  [key: string]: any;
};

export type OverpassOptions = "fee_no" | "wheelchair" | "recycling_type_centre" | "recycling_type_container";

export default {
  searchRecyclingSpots(bounds: any, options?: Ref<string[]>) {
    const toast = useToast();
    const sanitizedBounds = {
      south: bounds.getSouth(),
      north: bounds.getNorth(),
      west: bounds.getWest(),
      east: bounds.getEast(),
    };
    const rect = [
      sanitizedBounds.south,
      sanitizedBounds.west,
      sanitizedBounds.north,
      sanitizedBounds.east,
    ].join(",");

    let query = `[out:json];(`;

    if (options?.value.includes("recycling_type_centre")) {
      query += `node["amenity"="recycling"]["recycling_type"="centre"](${rect});`;
    }
    if (options?.value.includes("recycling_type_container")) {
      query += `node["amenity"="recycling"]["recycling_type"="container"](${rect});`;
    }

    query += `);out body;`;

    const url = `https://www.overpass-api.de/api/interpreter?data=${query}`;
    return axios
      .get<{ elements: OverpassElement[] }>(url)
      .then((response) => {
        console.log("RESPONSE", response);
        return response.data?.elements;
      })
      .catch((err) => {toast.error(err?.message); return []});
  },
};


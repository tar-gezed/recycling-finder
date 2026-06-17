import axios from "axios";
import type { LatLng } from "leaflet";

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
  recycling_type?: "center" | "container";
  [key: string]: any;
};

export type OverpassOptions =
  | "fee_no"
  | "wheelchair"
  | "recycling_type_centre"
  | "recycling_type_container";

let abortController: AbortController | null = null;

const ENDPOINTS = [
  "https://www.overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];

const getErrorMessage = (error: any): string => {
  if (error.response) {
    if (error.response.status === 429) {
      return "Les serveurs sont surchargés (trop de requêtes). Veuillez réessayer dans quelques instants.";
    }
    if (error.response.status >= 500) {
      return "Les serveurs de données sont temporairement indisponibles.";
    }
    return `Erreur serveur (${error.response.status}). Impossible de récupérer les données.`;
  }
  if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
    return "La requête a pris trop de temps. Essayez de zoomer pour réduire la zone de recherche.";
  }
  return "Erreur réseau. Veuillez vérifier votre connexion internet.";
};

export default {
  async searchRecyclingSpots(bounds: any, options?: string[]): Promise<OverpassElement[] | null> {
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();

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

    if (options?.includes("recycling_type_centre")) {
      query += `node["amenity"="recycling"]["recycling_type"="centre"](${rect});`;
    }
    if (options?.includes("recycling_type_container")) {
      query += `node["amenity"="recycling"]["recycling_type"="container"](${rect});`;
    }

    query += `);out body;`;

    let lastError: any = null;

    for (const endpoint of ENDPOINTS) {
      try {
        const url = `${endpoint}?data=${query}`;
        const response = await axios.get<{ elements: OverpassElement[] }>(url, {
          timeout: 60000,
          signal: abortController.signal
        });
        return response.data?.elements || [];
      } catch (err: any) {
        if (axios.isCancel(err)) {
          console.log('Requête Overpass annulée:', err.message);
          return null; // Retourne null silencieusement si la requête a été annulée
        }
        console.warn(`Erreur avec l'API ${endpoint}:`, err.message);
        lastError = err;
      }
    }

    // Si toutes les API ont échoué
    throw new Error(getErrorMessage(lastError));
  },
};

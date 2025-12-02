import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import LocateControl from "./LocateControl";
import AddressSearchControl from "./AddressSearchControl";

// Fix pour les icônes Leaflet manquantes
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DEFAULT_COORDS = [42.3094, 9.149];
const ENV_COORDS = import.meta.env.VITE_MAP_DEFAULT_CENTER
  ? import.meta.env.VITE_MAP_DEFAULT_CENTER.split(",").map(Number)
  : null;

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  return null;
}

export default function CitizenMap({ center, zoom = 13, children, className = "h-full w-full" }) {
  const defaultCenter = (import.meta.env.VITE_MAP_DEFAULT_CENTER || "42.3094,9.1490")
    .split(",")
    .map(Number);

  return (
    <MapContainer
      center={center || defaultCenter}
      zoom={zoom}
      scrollWheelZoom={true}
      className={className}
      style={{ minHeight: "400px", width: "100%", height: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController center={center} zoom={zoom} />
      <LocateControl />
      <AddressSearchControl />
      {children}
    </MapContainer>
  );
}

import type {MetadataRoute} from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Overdrive",
    short_name: "Overdrive",
    description: "A game library for the PS5, browsed the way the console does.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {src: "/icon-192.png", sizes: "192x192", type: "image/png"},
      {src: "/icon-512.png", sizes: "512x512", type: "image/png"},
    ],
  };
}

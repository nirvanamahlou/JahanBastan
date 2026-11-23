import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "جهان باستان",
    short_name: "جهان باستان",
    description: "تور، هتل و خدمات سفر جهان باستان",
    lang: "fa",
    dir: "rtl",
    start_url: "/login/?next=/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#012569",
    categories: ["travel"],
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "تورهای جهان باستان", short_name: "تورها", url: "/tours/" },
      { name: "حساب کاربری", short_name: "حساب من", url: "/account/" },
    ],
  };
}

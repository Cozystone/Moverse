import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moverse",
    short_name: "Moverse",
    description: "화면 밖에서 만나고, 함께 움직이는 학생 활동 세계",
    start_url: "/",
    display: "standalone",
    background_color: "#eff9ef",
    theme_color: "#0c1917",
    orientation: "portrait",
    icons: [{ src: "/moverse-icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

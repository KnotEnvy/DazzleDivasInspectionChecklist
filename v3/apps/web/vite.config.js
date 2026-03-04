import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: "autoUpdate",
            injectRegister: "auto",
            includeAssets: ["icon-192.svg", "icon-512.svg"],
            manifest: {
                name: "Dazzle Divas Field Checklist",
                short_name: "DazzleField",
                description: "Offline-ready cleaning and inspection checklists for field teams.",
                theme_color: "#0f766e",
                background_color: "#f8fafc",
                display: "standalone",
                start_url: "/",
                scope: "/",
                icons: [
                    {
                        src: "icon-192.svg",
                        sizes: "192x192",
                        type: "image/svg+xml",
                        purpose: "any"
                    },
                    {
                        src: "icon-512.svg",
                        sizes: "512x512",
                        type: "image/svg+xml",
                        purpose: "any maskable"
                    }
                ]
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,svg,png,ico,json}"],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/[^/]*convex\.cloud\//i,
                        handler: "NetworkFirst",
                        options: {
                            cacheName: "convex-runtime",
                            networkTimeoutSeconds: 5,
                        },
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "convex/_generated": path.resolve(__dirname, "../../packages/backend/convex/_generated"),
        },
    },
});

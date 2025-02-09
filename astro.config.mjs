import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import partytown from "@astrojs/partytown";
import { rehypeAccessibleEmojis } from "rehype-accessible-emojis";
import prefetch from "@astrojs/prefetch";

// https://astro.build/config
export default defineConfig({
  site: "https://redefine.io",
  trailingSlash: "always",
  compressHTML: true,
  integrations: [
    sitemap(),
    tailwind(),
    mdx({
      rehypePlugins: [rehypeAccessibleEmojis],
      shikiConfig: {
        theme: "material-theme-palenight",
      },
    }),
    partytown({
      config: {
        forward: ["dataLayer.push"],
      },
    }),
    prefetch(),
  ],
});

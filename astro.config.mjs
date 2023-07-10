import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import partytown from "@astrojs/partytown";
import { rehypeAccessibleEmojis } from 'rehype-accessible-emojis';
import prefetch from "@astrojs/prefetch";

// https://astro.build/config
export default defineConfig({
  site: "https://redefine.io",
  trailingSlash: "always",
  integrations: [sitemap(), tailwind(), mdx(), partytown({
    config: {
      forward: ["dataLayer.push"]
    }
  }), prefetch()],
  markdown: {
    rehypePlugins: [rehypeAccessibleEmojis],
    shikiConfig: {
      theme: "material-palenight"
    },
  },
  experimental: {
    assets: true
  }
});
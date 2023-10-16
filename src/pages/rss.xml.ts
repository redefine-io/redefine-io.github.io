import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET() {
  const blogEntries = await getCollection("blog");
  blogEntries.sort(
    (a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime()
  );

  return rss({
    title: "Redefine | Data Reimagined",
    description: `At Redefine, we empower businesses to harness the full power
    of their data through advanced data engineering and analytics solutions.`,
    site: "https://redefine.io",
    items: blogEntries.map(({ slug, data }) => ({
      link: `/blog/${slug}/`,
      title: data.title,
      description: data.description,
      pubDate: new Date(data.publishDate),
    })),
  });
}

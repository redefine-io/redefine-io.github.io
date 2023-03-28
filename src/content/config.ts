import { defineCollection, image, z } from "astro:content";

export const collections = {
  authors: defineCollection({
    schema: z.object({
      name: z.string(),
      title: z.string(),
      image: image(),
    }),
  }),
  blog: defineCollection({
    schema: z.object({
      title: z.string(),
      description: z.string(),
      publishDate: z.coerce.date(),
      author: z.string().default("Redefine"),
    }),
  }),
  policies: defineCollection({
    schema: z.object({
      title: z.string(),
      description: z.string(),
      updatedDate: z.coerce.date(),
    }),
  }),
};

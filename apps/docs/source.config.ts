import {
  defineConfig,
  defineDocs,
  metaSchema,
} from 'fumadocs-mdx/config';
import { z } from 'zod';

// Custom frontmatter schema with optional title/description
const customFrontmatterSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  full: z.boolean().optional(),
});

// Point to root /docs folder for easier browsing in GitHub
export const docs = defineDocs({
  dir: '../../docs',
  docs: {
    schema: customFrontmatterSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    // MDX options
  },
});

// source.config.ts
import {
  defineConfig,
  defineDocs,
  metaSchema
} from "fumadocs-mdx/config";
import { z } from "zod";
var customFrontmatterSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  full: z.boolean().optional()
});
var docs = defineDocs({
  dir: "../../docs",
  docs: {
    schema: customFrontmatterSchema,
    postprocess: {
      includeProcessedMarkdown: true
    }
  },
  meta: {
    schema: metaSchema
  }
});
var source_config_default = defineConfig({
  mdxOptions: {
    // MDX options
  }
});
export {
  source_config_default as default,
  docs
};

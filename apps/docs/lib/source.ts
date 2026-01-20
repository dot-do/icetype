import { docs } from '@/.source';
import { loader } from 'fumadocs-core/source';
import { icons } from 'lucide-react';
import { createElement } from 'react';

export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
  icon(icon) {
    if (!icon) {
      return;
    }
    if (icon in icons) return createElement(icons[icon as keyof typeof icons]);
  },
});

export function getPageImage(slugs: string[]): string {
  const segments = [...slugs];
  if (segments.length === 0) segments.push('index');
  return `/og/docs/${segments.join('/')}/image.png`;
}

export function getLLMText(page: {
  data: { title: string; processed?: { textContent?: string } };
}): string {
  return `# ${page.data.title}\n\n${page.data.processed?.textContent ?? ''}`;
}

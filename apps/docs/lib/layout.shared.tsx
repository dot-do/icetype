import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Snowflake } from 'lucide-react';
import { createElement } from 'react';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: createElement(
        'span',
        { className: 'flex items-center gap-2 font-bold' },
        createElement(Snowflake, { className: 'h-5 w-5 text-cyan-500' }),
        'IceType'
      ),
    },
    links: [
      {
        text: 'Documentation',
        url: '/',
        active: 'nested-url',
      },
      {
        text: 'GitHub',
        url: 'https://github.com/dot-do/icetype',
        external: true,
      },
      {
        text: 'npm',
        url: 'https://www.npmjs.com/package/icetype',
        external: true,
      },
    ],
    githubUrl: 'https://github.com/dot-do/icetype',
  };
}

import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'IceType',
    },
    links: [
      {
        text: 'GitHub',
        url: 'https://github.com/dot-do/icetype',
      },
    ],
  };
}

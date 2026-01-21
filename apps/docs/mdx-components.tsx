import type { MDXComponents } from 'mdx/types';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Callout } from 'fumadocs-ui/components/callout';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import {
  BookOpen,
  Code,
  Database,
  FileCode,
  Layers,
  Zap,
  ArrowRight,
} from 'lucide-react';
import type { ReactNode } from 'react';

// Feature card component for showcasing features
function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <div className="feature-card">
      {icon && <div className="mb-3 text-cyan-500">{icon}</div>}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-fd-muted-foreground">{description}</p>
    </div>
  );
}

// Feature grid wrapper
function FeatureGrid({ children }: { children: ReactNode }) {
  return <div className="feature-grid">{children}</div>;
}

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    // Fumadocs built-in components
    Callout,
    Card,
    Cards,
    Tab,
    Tabs,
    Step,
    Steps,
    TypeTable,
    // Custom components
    FeatureCard,
    FeatureGrid,
    // Icons for use in docs
    BookOpen,
    Code,
    Database,
    FileCode,
    Layers,
    Zap,
    ArrowRight,
    ...components,
  };
}

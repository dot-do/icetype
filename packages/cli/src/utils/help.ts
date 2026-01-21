/**
 * Shared help text generation utility for CLI commands.
 *
 * Provides consistent help formatting across all subcommands.
 */

/**
 * Option definition for help text generation.
 */
export interface HelpOption {
  /** Long form flag (e.g., 'schema') */
  name: string;
  /** Short form flag (e.g., 's') */
  short?: string;
  /** Description of the option */
  description: string;
  /** Whether the option is required */
  required?: boolean;
  /** Default value if any */
  defaultValue?: string;
}

/**
 * Command definition for help text generation.
 */
export interface HelpCommand {
  /** Name of the command (e.g., 'generate') */
  name: string;
  /** Brief description of the command */
  description: string;
  /** Full usage string (e.g., 'ice generate --schema ./schema.ts --output ./types.ts') */
  usage: string;
  /** Available options for this command */
  options: HelpOption[];
  /** Example usages */
  examples?: string[];
  /** Available subcommands (for parent commands like 'clickhouse') */
  subcommands?: { name: string; description: string }[];
}

/**
 * Generate help text for a command.
 *
 * @param command - Command definition
 * @returns Formatted help text
 */
export function generateHelpText(command: HelpCommand): string {
  const lines: string[] = [];

  // Header - split description on newline and use first line for header
  const descLines = command.description.split('\n');
  const shortDesc = (descLines[0] ?? '').trim();
  lines.push(`ice ${command.name} - ${shortDesc}`);
  lines.push('');

  // If description has multiple lines, add them as a description block
  if (descLines.length > 1) {
    lines.push('Description:');
    for (let i = 1; i < descLines.length; i++) {
      const line = descLines[i] ?? '';
      // Preserve indentation for multi-line descriptions
      lines.push(line ? `  ${line}` : '');
    }
    lines.push('');
  }

  // Usage
  lines.push('Usage:');
  lines.push(`  ${command.usage}`);
  lines.push('');

  // Subcommands (if any)
  if (command.subcommands && command.subcommands.length > 0) {
    lines.push('Subcommands:');
    const maxSubLen = Math.max(...command.subcommands.map((s) => s.name.length));
    for (const sub of command.subcommands) {
      lines.push(`  ${sub.name.padEnd(maxSubLen + 2)}${sub.description}`);
    }
    lines.push('');
  }

  // Options
  if (command.options.length > 0) {
    lines.push('Options:');
    for (const opt of command.options) {
      const shortFlag = opt.short ? `-${opt.short}, ` : '    ';
      const longFlag = `--${opt.name}`;
      const required = opt.required ? ' (required)' : '';
      const defaultVal = opt.defaultValue ? ` (default: ${opt.defaultValue})` : '';
      lines.push(`  ${shortFlag}${longFlag.padEnd(18)}${opt.description}${required}${defaultVal}`);
    }
    lines.push('');
  }

  // Common options
  lines.push('  -h, --help              Show this help message');
  lines.push('');

  // Examples
  if (command.examples && command.examples.length > 0) {
    lines.push('Examples:');
    for (const example of command.examples) {
      lines.push(`  ${example}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Check if args contain a help flag (-h or --help).
 *
 * @param args - Command line arguments
 * @returns True if help flag is present
 */
export function hasHelpFlag(args: string[]): boolean {
  return args.includes('-h') || args.includes('--help');
}

/**
 * Show help text and exit if help flag is present.
 *
 * @param args - Command line arguments
 * @param command - Command definition
 * @returns True if help was shown (and process should exit), false otherwise
 */
export function showHelpIfRequested(args: string[], command: HelpCommand): boolean {
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(command));
    return true;
  }
  return false;
}

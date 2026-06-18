/**
 * Parses AdvPL/TLPP source into named blocks (header + functions + methods + classes).
 * Block-level granularity is the unit of the three-way merge.
 */

export interface AdvplBlock {
  name: string;
  kind: 'header' | 'function' | 'method' | 'class';
  lines: string[];
}

export interface ParsedSource {
  blocks: AdvplBlock[];
}

const FUNCTION_RE = /^(USER\s+FUNCTION|STATIC\s+FUNCTION|FUNCTION)\s+(\w+)/i;
const METHOD_RE   = /^METHOD\s+(\w+)\s*\([^)]*\)\s+CLASS\s+(\w+)/i;
const CLASS_RE    = /^CLASS\s+(\w+)/i;

export function parseAdvpl(source: string): ParsedSource {
  const rawLines = source.split('\n');
  const blocks: AdvplBlock[] = [];

  let currentName: string = '__header__';
  let currentKind: AdvplBlock['kind'] = 'header';
  let currentLines: string[] = [];

  function flush(): void {
    blocks.push({ name: currentName, kind: currentKind, lines: currentLines });
  }

  for (const line of rawLines) {
    const methodMatch = METHOD_RE.exec(line);
    if (methodMatch) {
      flush();
      const methodName = methodMatch[1] ?? '';
      const className  = methodMatch[2] ?? '';
      currentName  = `${className}.${methodName}`;
      currentKind  = 'method';
      currentLines = [line];
      continue;
    }

    const funcMatch = FUNCTION_RE.exec(line);
    if (funcMatch) {
      flush();
      currentName  = funcMatch[2] ?? '';
      currentKind  = 'function';
      currentLines = [line];
      continue;
    }

    const classMatch = CLASS_RE.exec(line);
    if (classMatch) {
      flush();
      currentName  = classMatch[1] ?? '';
      currentKind  = 'class';
      currentLines = [line];
      continue;
    }

    currentLines.push(line);
  }

  flush();
  return { blocks };
}

export function blockContent(block: AdvplBlock): string {
  return block.lines.join('\n');
}

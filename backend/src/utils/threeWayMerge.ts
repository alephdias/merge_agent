/**
 * Three-way merge at block (function/method) level.
 * Returns resolved segments and conflict segments to be resolved externally (e.g., Claude API).
 */

import { parseAdvpl, blockContent } from './advplParser';
import type { AdvplBlock } from './advplParser';

export type ChangeCategory =
  | 'igual'        // unchanged in all three
  | 'totvs_update' // TOTVS updated, empresa untouched
  | 'empresa'      // empresa customized, TOTVS untouched
  | 'conflito'     // both changed differently — needs AI resolution
  | 'novo_totvs'   // new block added by TOTVS
  | 'removido';    // removed by TOTVS (empresa untouched)

export interface ResolvedSegment {
  kind: 'resolved';
  blockName: string;
  category: ChangeCategory;
  content: string; // multi-line block content; empty string for 'removido'
  removedContent?: string; // original content (only for 'removido', for report display)
}

export interface ConflictSegment {
  kind: 'conflict';
  blockName: string;
  ancestorContent: string | null;
  totvsContent: string | null;
  empresaContent: string | null;
}

export type MergeSegment = ResolvedSegment | ConflictSegment;

export interface MergeOutput {
  segments: MergeSegment[];
  conflictCount: number;
}

export function threeWayMerge(
  ancestorSource: string,
  totvsSource: string,
  empresaSource: string,
): MergeOutput {
  const ancestor = parseAdvpl(ancestorSource);
  const totvs    = parseAdvpl(totvsSource);
  const empresa  = parseAdvpl(empresaSource);

  const aMap = new Map<string, AdvplBlock>(ancestor.blocks.map((b) => [b.name, b]));
  const tMap = new Map<string, AdvplBlock>(totvs.blocks.map((b) => [b.name, b]));
  const eMap = new Map<string, AdvplBlock>(empresa.blocks.map((b) => [b.name, b]));

  // Ordered by totvs (reference version), then append empresa-only blocks
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const b of totvs.blocks)   { ordered.push(b.name); seen.add(b.name); }
  for (const b of empresa.blocks) { if (!seen.has(b.name)) ordered.push(b.name); }

  const segments: MergeSegment[] = [];
  let conflictCount = 0;

  for (const name of ordered) {
    const aBlock = aMap.get(name);
    const tBlock = tMap.get(name);
    const eBlock = eMap.get(name);

    const aC = aBlock !== undefined ? blockContent(aBlock) : null;
    const tC = tBlock !== undefined ? blockContent(tBlock) : null;
    const eC = eBlock !== undefined ? blockContent(eBlock) : null;

    const hasA = aC !== null;
    const hasT = tC !== null;
    const hasE = eC !== null;

    const sameAT = hasA && hasT && aC === tC;
    const sameAE = hasA && hasE && aC === eC;
    const sameTE = hasT && hasE && tC === eC;

    // All three exist
    if (hasA && hasT && hasE) {
      if (sameAT && sameAE) {
        segments.push({ kind: 'resolved', category: 'igual', content: tC, blockName: name });
      } else if (!sameAT && sameAE) {
        segments.push({ kind: 'resolved', category: 'totvs_update', content: tC, blockName: name });
      } else if (sameAT && !sameAE) {
        segments.push({ kind: 'resolved', category: 'empresa', content: eC, blockName: name });
      } else if (sameTE) {
        // Both changed the same way
        segments.push({ kind: 'resolved', category: 'totvs_update', content: tC, blockName: name });
      } else {
        segments.push({ kind: 'conflict', blockName: name, ancestorContent: aC, totvsContent: tC, empresaContent: eC });
        conflictCount++;
      }
      continue;
    }

    // New in TOTVS only
    if (!hasA && hasT && !hasE) {
      segments.push({ kind: 'resolved', category: 'novo_totvs', content: tC, blockName: name });
      continue;
    }

    // New in empresa only
    if (!hasA && !hasT && hasE) {
      segments.push({ kind: 'resolved', category: 'empresa', content: eC, blockName: name });
      continue;
    }

    // TOTVS removed, empresa still has it
    if (hasA && !hasT && hasE) {
      if (sameAE) {
        // Empresa untouched → safe to remove
        segments.push({ kind: 'resolved', category: 'removido', content: '', removedContent: aC, blockName: name });
      } else {
        // Empresa modified what TOTVS removed → conflict
        segments.push({ kind: 'conflict', blockName: name, ancestorContent: aC, totvsContent: null, empresaContent: eC });
        conflictCount++;
      }
      continue;
    }

    // TOTVS exists, empresa doesn't (empresa deleted it or never had it)
    if (hasA && hasT && !hasE) {
      const category: ChangeCategory = sameAT ? 'igual' : 'totvs_update';
      segments.push({ kind: 'resolved', category, content: tC, blockName: name });
      continue;
    }

    // Both removed (or only in ancestor)
    if (hasA && !hasT && !hasE) {
      segments.push({ kind: 'resolved', category: 'removido', content: '', removedContent: aC, blockName: name });
      continue;
    }

    // Both added independently (not in ancestor)
    if (!hasA && hasT && hasE) {
      if (sameTE) {
        segments.push({ kind: 'resolved', category: 'empresa', content: tC, blockName: name });
      } else {
        segments.push({ kind: 'conflict', blockName: name, ancestorContent: null, totvsContent: tC, empresaContent: eC });
        conflictCount++;
      }
    }
  }

  return { segments, conflictCount };
}

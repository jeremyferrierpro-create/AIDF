import { aidfPaths, AIDF_VERSION } from '../paths.mjs';
import { readJson, exists } from '../util/fsx.mjs';

export const LINK_TYPES = ['implements', 'designed-by', 'implemented-by', 'verified-by', 'evidenced-by'];

/**
 * Load all artefacts from the artefacts directory.
 */
export async function loadAllArtefacts(root) {
  const artefacts = new Map();
  const { readDirSafe } = await import('../util/fsx.mjs');
  
  const artefactsDir = aidfPaths(root).artefacts;
  if (!await exists(artefactsDir)) {
    return artefacts;
  }
  
  const entries = await readDirSafe(artefactsDir);
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json') {
      try {
        const body = await readJson(`${artefactsDir}/${entry.name}`, null);
        if (body && body.id) {
          artefacts.set(body.id, body);
        }
      } catch {
        // Skip malformed files
      }
    }
  }
  
  return artefacts;
}

/**
 * Resolve a link to its target artefact.
 */
export async function resolveLink(root, targetId) {
  const artefacts = await loadAllArtefacts(root);
  return artefacts.get(targetId) || null;
}

/**
 * Verify a traceability chain for a given artefact.
 * Returns { ok, path, brokenLinks, coverage }
 */
export async function verifyChain(root, artefactId, options = {}) {
  const artefacts = await loadAllArtefacts(root);
  const start = artefacts.get(artefactId);
  
  if (!start) {
    return {
      ok: false,
      artefactId,
      brokenLinks: [`Artefact not found: ${artefactId}`],
      coverage: null
    };
  }
  
  const path = [artefactId];
  const brokenLinks = [];
  
  // Follow links of type: requirement -> design -> implementation -> test -> evidence
  let current = start;
  let maxDepth = options.maxDepth || 5;
  let depth = 0;
  
  while (depth < maxDepth && current.links) {
    // Try to find the next link type
    const nextId = current.links.implementedBy?.[0] || 
                   current.links.verifiedBy?.[0] || 
                   current.links.evidencedBy?.[0] ||
                   current.links.designedBy?.[0] ||
                   current.links.implements?.[0];
    
    if (!nextId) break;
    
    const next = await resolveLink(root, nextId);
    if (!next) {
      brokenLinks.push(`Missing link: ${current.id} -> ${nextId}`);
      break;
    }
    
    path.push(nextId);
    current = next;
    depth++;
  }
  
  // Calculate coverage based on path
  const coverage = calculateCoverage(path, artefacts);
  
  return {
    ok: brokenLinks.length === 0,
    artefactId,
    path,
    brokenLinks,
    coverage
  };
}

/**
 * Find all broken links in the artefacts directory.
 */
export async function findBrokenLinks(root, options = {}) {
  const artefacts = await loadAllArtefacts(root);
  const broken = [];
  
  for (const [id, artefact] of artefacts) {
    if (!artefact.links) continue;
    
    const linkTypes = ['implements', 'designedBy', 'implementedBy', 'verifiedBy', 'evidencedBy'];
    for (const linkType of linkTypes) {
      const targetIds = artefact.links[linkType];
      if (!targetIds || !Array.isArray(targetIds)) continue;
      
      for (const targetId of targetIds) {
        if (!artefacts.has(targetId)) {
          broken.push({
            sourceId: id,
            linkType,
            targetId,
            reason: `Target artefact not found: ${targetId}`
          });
        }
      }
    }
  }
  
  return broken;
}

/**
 * Find artefacts without a specific type of link.
 */
export async function findMissingLinks(root, options = {}) {
  const artefacts = await loadAllArtefacts(root);
  const missing = [];
  
  const targetType = options.type;
  if (!targetType) {
    throw new Error('Missing --type option (requirement, design, implementation, test, evidence)');
  }
  
  for (const [id, artefact] of artefacts) {
    const links = artefact.links || {};
    const hasLink = links.implements?.includes(targetType) ||
                    links.designedBy?.includes(targetType) ||
                    links.implementedBy?.includes(targetType) ||
                    links.verifiedBy?.includes(targetType) ||
                    links.evidencedBy?.includes(targetType);
    
    if (!hasLink) {
      missing.push({
        id,
        type: artefact.type || 'unknown',
        missing: targetType
      });
    }
  }
  
  return missing;
}

/**
 * Calculate coverage for a path of artefacts.
 */
function calculateCoverage(path, artefacts) {
  if (path.length === 0) return null;
  
  const start = artefacts.get(path[0]);
  if (!start || start.type !== 'requirement') return null;
  
  const criteriaCount = start.acceptanceCriteria?.length || 0;
  const hasTest = path.some(id => artefacts.get(id)?.type === 'test');
  const hasEvidence = path.some(id => artefacts.get(id)?.type === 'evidence');
  
  return {
    requirementId: path[0],
    acceptanceCriteria: criteriaCount,
    hasImplementation: path.some(id => artefacts.get(id)?.type === 'implementation'),
    hasTest,
    hasEvidence,
    isFullyTraced: criteriaCount > 0 && hasTest && hasEvidence
  };
}
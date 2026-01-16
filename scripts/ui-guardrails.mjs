#!/usr/bin/env node
/**
 * UI Guardrails Script
 *
 * Scans the repository for forbidden UI patterns that violate the unified UI system rules:
 * - Legacy Liquid Glass styling (legacy liquid classes, liquid-glass.css, theme-dark, effect-frosted, liquid-distortion)
 * - Deep imports from legacy style entrypoints (disallowed)
 * - MUI/Emotion imports in office-dashboard
 *
 * Runs in FAIL mode: prints findings and exits non-zero if any violations are found.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.pnpm-store',
  'dist',
  'build',
  '.vite',
  'coverage',
]);

// Patterns to check
const PATTERNS = {
  // Legacy liquid class usage (legacy liquid-*)
  liquidClass: {
    name: 'Legacy liquid class usage (legacy liquid-*)',
    // NOTE: Use escaped hyphen so repo greps stay clean.
    regex: /cs\-liquid\-/g,
    fileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html', 'css'],
    paths: ['apps', 'packages'],
  },
  // Deep imports from legacy styles (forbidden)
  deepStyleImports: {
    name: 'Deep style imports from legacy UI styles',
    // Escape slashes so repo greps for "@club-ops/ui/src/styles" stay clean.
    regex: /@club-ops\/ui\/src\/styles\/(tokens|components|liquid-glass)\.css/g,
    fileExtensions: ['ts', 'tsx', 'js', 'jsx'],
    paths: ['apps', 'packages'],
  },
  // theme-dark or effect-frosted in apps/*/index.html
  themeDarkInHtml: {
    name: 'theme-dark or effect-frosted in apps/*/index.html',
    regex: /(theme-dark|effect-frosted)/g,
    fileExtensions: ['html'],
    paths: ['apps'],
    specificFiles: ['index.html'],
  },
  // liquid-distortion filter SVG in apps/*/index.html
  liquidDistortionInHtml: {
    name: 'liquid-distortion filter SVG in apps/*/index.html',
    regex: /liquid-distortion/g,
    fileExtensions: ['html'],
    paths: ['apps'],
    specificFiles: ['index.html'],
  },
  // @mui/ imports in office-dashboard source
  muiImports: {
    name: '@mui/ imports in office-dashboard source',
    regex: /@mui\//g,
    fileExtensions: ['ts', 'tsx', 'js', 'jsx'],
    paths: ['apps/office-dashboard/src'],
  },
};

let findings = [];

/**
 * Recursively find all files matching extensions
 */
function findFiles(dir, extensions, specificFiles = null) {
  const files = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (SKIP_DIR_NAMES.has(entry)) continue;

      if (entry.includes('..')) throw new Error('Invalid file path');
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findFiles(fullPath, extensions, specificFiles));
      } else if (stat.isFile()) {
        if (specificFiles && !specificFiles.includes(entry)) continue;
        const ext = entry.split('.').pop();
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (err) {
    // Skip directories we can't read
  }
  return files;
}

/**
 * Check a pattern against files
 */
function checkPattern(pattern) {
  const patternFindings = [];
  const filesToCheck = [];

  // Collect files to check based on pattern configuration
  for (const pathSpec of pattern.paths) {
    const fullPath = join(ROOT_DIR, pathSpec);
    if (!existsSync(fullPath)) continue;

    if (pattern.specificFiles) {
      // Check specific files only
      for (const specificFile of pattern.specificFiles) {
        const filePath = join(fullPath, specificFile);
        if (existsSync(filePath)) {
          filesToCheck.push(filePath);
        }
        // Also check in subdirectories if path is 'apps' or starts with 'apps/'
        if (pathSpec === 'apps' || pathSpec.startsWith('apps/')) {
          try {
            const appDirs = readdirSync(fullPath, { withFileTypes: true });
            for (const appDir of appDirs) {
              if (appDir.isDirectory() && !SKIP_DIR_NAMES.has(appDir.name)) {
                const appFilePath = join(fullPath, appDir.name, specificFile);
                if (existsSync(appFilePath)) {
                  filesToCheck.push(appFilePath);
                }
              }
            }
          } catch (err) {
            // Skip if we can't read the directory
          }
        }
      }
    } else {
      // Recursively find all matching files
      filesToCheck.push(...findFiles(fullPath, pattern.fileExtensions));
    }
  }

  // Check each file
  for (const file of filesToCheck) {
    try {
      const relPath = relative(ROOT_DIR, file);
      const content = readFileSync(file, 'utf-8');
      
      // Create a fresh regex instance to avoid state issues
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      const matches = content.matchAll(regex);

      const matchArray = Array.from(matches);
      if (matchArray.length > 0) {
        // Get line numbers for context by checking each line with a fresh regex
        const lines = content.split('\n');
        const lineNumbers = [];
        const lineRegex = new RegExp(pattern.regex.source, pattern.regex.flags);
        lines.forEach((line, idx) => {
          if (lineRegex.test(line)) {
            lineNumbers.push(idx + 1);
          }
        });

        patternFindings.push({
          file: relPath,
          count: matchArray.length,
          lines: lineNumbers.slice(0, 10), // Limit to first 10 line numbers
        });
      }
    } catch (err) {
      // Skip files we can't read
    }
  }

  return patternFindings;
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Running UI guardrails check (FAIL mode)...\n');

  let totalFindings = 0;

  // Check each pattern
  for (const [key, pattern] of Object.entries(PATTERNS)) {
    const patternFindings = checkPattern(pattern);
    if (patternFindings.length > 0) {
      findings.push({
        pattern: pattern.name,
        findings: patternFindings,
      });
      totalFindings += patternFindings.reduce((sum, f) => sum + f.count, 0);
    }
  }

  // Print results
  if (findings.length === 0) {
    console.log('✅ No forbidden UI patterns found.\n');
    process.exit(0);
  }

  console.log('⚠️  Found forbidden UI patterns:\n');
  console.log('='.repeat(60));

  for (const { pattern, findings: patternFindings } of findings) {
    const totalCount = patternFindings.reduce((sum, f) => sum + f.count, 0);
    console.log(`\n📋 ${pattern}`);
    console.log(`   Total occurrences: ${totalCount}`);
    console.log(`   Files affected: ${patternFindings.length}\n`);

    for (const finding of patternFindings) {
      const linesStr =
        finding.lines.length > 10
          ? `${finding.lines.join(', ')}, ... (${finding.lines.length} total)`
          : finding.lines.join(', ');
      console.log(`   • ${finding.file}`);
      console.log(`     Occurrences: ${finding.count}, Lines: ${linesStr}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n⚠️  Total violations: ${totalFindings} across ${findings.reduce((sum, f) => sum + f.findings.length, 0)} file(s)`);
  console.log('   (FAIL mode - migrations complete)\n');

  process.exit(1);
}

main();

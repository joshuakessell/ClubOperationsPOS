#!/usr/bin/env node
/**
 * Largest Files Script
 *
 * Scans the repository for TypeScript/TSX files and identifies the largest ones.
 * Useful for identifying files that may need to be split up per AGENTS.md rules.
 *
 * Outputs:
 * - Top 50 TS/TSX files by size (in KB)
 * - Writes results to docs/refactor/largest-files.md
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
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
  '.next',
  '.turbo',
]);

const FILE_EXTENSIONS = ['ts', 'tsx'];

/**
 * Recursively find all TS/TSX files
 */
function findFiles(dir) {
  const files = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (SKIP_DIR_NAMES.has(entry)) continue;

      if (entry.includes('..')) throw new Error('Invalid file path');
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findFiles(fullPath));
      } else if (stat.isFile()) {
        const ext = entry.split('.').pop();
        if (FILE_EXTENSIONS.includes(ext)) {
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
 * Get file size in bytes
 */
function getFileSize(filePath) {
  try {
    const stat = statSync(filePath);
    return stat.size;
  } catch (err) {
    return 0;
  }
}

/**
 * Get line count for a file
 */
function getLineCount(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch (err) {
    return 0;
  }
}

/**
 * Format bytes to KB
 */
function formatKB(bytes) {
  return (bytes / 1024).toFixed(2);
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Scanning for TypeScript/TSX files...\n');

  // Find all TS/TSX files
  const allFiles = findFiles(ROOT_DIR);

  console.log(`Found ${allFiles.length} TypeScript/TSX files\n`);

  // Get file sizes and line counts
  const fileData = allFiles.map((file) => {
    const relPath = relative(ROOT_DIR, file);
    const size = getFileSize(file);
    const lines = getLineCount(file);
    return {
      path: relPath,
      size,
      lines,
      sizeKB: parseFloat(formatKB(size)),
    };
  });

  // Sort by size (descending)
  fileData.sort((a, b) => b.size - a.size);

  // Get top 50
  const top50 = fileData.slice(0, 50);

  // Generate markdown content
  const timestamp = new Date().toISOString();
  let markdown = `# Largest TypeScript/TSX Files\n\n`;
  markdown += `Generated: ${timestamp}\n\n`;
  markdown += `This document lists the top 50 TypeScript/TSX files by size (in KB). `;
  markdown += `Files that exceed AGENTS.md guidelines (200-300 lines for components, 300-500 for views) are candidates for refactoring.\n\n`;
  markdown += `**Total files scanned:** ${allFiles.length}\n\n`;
  markdown += `---\n\n`;
  markdown += `| Rank | File | Size (KB) | Lines | Notes |\n`;
  markdown += `|------|------|-----------|-------|-------|\n`;

  top50.forEach((file, index) => {
    const rank = index + 1;
    const notes = [];
    
    // Add notes based on size/line count
    if (file.lines > 500) {
      notes.push('⚠️ Exceeds view/page guideline (300-500 lines)');
    } else if (file.lines > 300 && file.path.includes('/components/')) {
      notes.push('⚠️ Exceeds component guideline (200-300 lines)');
    }
    
    if (file.path.includes('AppRoot.tsx') && file.lines > 300) {
      notes.push('⚠️ Violates "No Components in AppRoot" rule');
    }
    
    if (file.path.includes('App.tsx') && file.lines > 300) {
      notes.push('⚠️ Consider extracting to views/components');
    }

    const notesStr = notes.length > 0 ? notes.join('; ') : '-';
    markdown += `| ${rank} | \`${file.path}\` | ${file.sizeKB} | ${file.lines} | ${notesStr} |\n`;
  });

  markdown += `\n---\n\n`;
  markdown += `## Summary Statistics\n\n`;
  
  // Calculate statistics
  const totalSize = fileData.reduce((sum, f) => sum + f.size, 0);
  const totalLines = fileData.reduce((sum, f) => sum + f.lines, 0);
  const avgSize = totalSize / fileData.length;
  const avgLines = totalLines / fileData.length;
  
  const largeFiles = fileData.filter(f => f.lines > 300).length;
  const veryLargeFiles = fileData.filter(f => f.lines > 500).length;
  const appRootFiles = fileData.filter(f => f.path.includes('AppRoot.tsx') && f.lines > 300);

  markdown += `- **Total files:** ${allFiles.length}\n`;
  markdown += `- **Total size:** ${formatKB(totalSize)} KB\n`;
  markdown += `- **Total lines:** ${totalLines.toLocaleString()}\n`;
  markdown += `- **Average file size:** ${formatKB(avgSize)} KB\n`;
  markdown += `- **Average lines per file:** ${Math.round(avgLines)}\n`;
  markdown += `- **Files > 300 lines:** ${largeFiles}\n`;
  markdown += `- **Files > 500 lines:** ${veryLargeFiles}\n`;
  
  if (appRootFiles.length > 0) {
    markdown += `- **AppRoot files > 300 lines:** ${appRootFiles.length}\n`;
    appRootFiles.forEach(f => {
      markdown += `  - \`${f.path}\`: ${f.lines} lines\n`;
    });
  }

  // Write to file
  const outputPath = join(ROOT_DIR, 'docs/refactor/largest-files.md');
  writeFileSync(outputPath, markdown, 'utf-8');

  console.log('✅ Analysis complete!\n');
  console.log(`📊 Top 10 largest files:\n`);
  top50.slice(0, 10).forEach((file, index) => {
    console.log(`  ${index + 1}. ${file.path}`);
    console.log(`     ${file.sizeKB} KB, ${file.lines} lines`);
  });
  
  console.log(`\n📝 Full report written to: docs/refactor/largest-files.md\n`);
  
  // Print warnings for files that exceed guidelines
  const warnings = top50.filter(f => {
    if (f.lines > 500) return true;
    if (f.lines > 300 && f.path.includes('/components/')) return true;
    if (f.path.includes('AppRoot.tsx') && f.lines > 300) return true;
    return false;
  });

  if (warnings.length > 0) {
    console.log('⚠️  Files exceeding AGENTS.md guidelines:\n');
    warnings.forEach(f => {
      console.log(`  - ${f.path}: ${f.lines} lines`);
    });
    console.log('');
  }

  process.exit(0);
}

main();

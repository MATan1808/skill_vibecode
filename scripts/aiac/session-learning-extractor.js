#!/usr/bin/env node
/**
 * AIaC Multi-Client Session Learning Engine
 * Trích xuất các quyết định kỹ thuật, quy chuẩn & feedback từ session history của 4 AI Editors:
 * - Claude Code (<ENV_ROOT>/.claude)
 * - Codex CLI (<ENV_ROOT>/.codex)
 * - Gemini CLI (<ENV_ROOT>/.gemini)
 * - Antigravity IDE (<ENV_ROOT>/.antigravity-ide)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function extractLearningInsights() {
  const insights = [];
  const envRoot = process.env.AIAC_ENV_ROOT || (fs.existsSync('/Volumes/DATA/ENV') ? '/Volumes/DATA/ENV' : os.homedir());
  const projectsDir = path.join(envRoot, '.claude', 'projects');

  if (!fs.existsSync(projectsDir)) return insights;

  const projectFolders = fs.readdirSync(projectsDir);
  for (const folder of projectFolders) {
    const folderPath = path.join(projectsDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.jsonl'));
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      try {
        const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
        for (const line of lines) {
          const entry = JSON.parse(line);
          if (entry.type === 'user_message' || entry.type === 'user') {
            const text = entry.message?.content || entry.text || '';
            if (typeof text === 'string') {
              if (
                text.includes('bắt buộc') ||
                text.includes('quy chuẩn') ||
                text.includes('rule') ||
                text.includes('nhớ') ||
                text.includes('không được') ||
                text.includes('yêu cầu') ||
                text.includes('global') ||
                text.includes('tiêu chuẩn')
              ) {
                const clean = text.replace(/\n+/g, ' ').trim();
                if (clean.length > 15 && clean.length < 350) {
                  // Determine domain / category
                  let category = 'Global / Workflow';
                  const lower = clean.toLowerCase();
                  if (lower.includes('odoo') || lower.includes('owl') || lower.includes('vuahethong')) {
                    category = 'Odoo & Web ERP';
                  } else if (lower.includes('git') || lower.includes('push') || lower.includes('repo') || lower.includes('commit')) {
                    category = 'Git Remote & Docs Sync';
                  } else if (lower.includes('vuaoffice') || lower.includes('vassistant') || lower.includes('v-assistant') || lower.includes('macos')) {
                    category = 'Desktop & Mobile Apps';
                  } else if (lower.includes('wordpress') || lower.includes('cloudpanel') || lower.includes('ioc')) {
                    category = 'CloudPanel & WordPress';
                  } else if (lower.includes('link') || lower.includes('volume') || lower.includes('xưng hô') || lower.includes('tiếng việt')) {
                    category = 'Communication & File Links';
                  }

                  insights.push({
                    client: 'Claude Code',
                    source: folder.replace(/^-Volumes-DATA-/, ''),
                    category: category,
                    feedback: clean
                  });
                }
              }
            }
          }
        }
      } catch (e) {}
    }
  }

  // Deduplicate by text similarity
  const unique = [];
  const seen = new Set();
  for (const item of insights) {
    const key = item.feedback.toLowerCase().substring(0, 60);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique;
}

if (require.main === module) {
  const items = extractLearningInsights();
  console.log(JSON.stringify(items, null, 2));
}

module.exports = { extractLearningInsights };

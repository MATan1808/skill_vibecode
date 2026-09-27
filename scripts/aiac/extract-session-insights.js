const fs = require('fs');
const path = require('path');
const os = require('os');

function scanSessions() {
  const envRoot = process.env.AIAC_ENV_ROOT || (fs.existsSync('/Volumes/DATA/ENV') ? '/Volumes/DATA/ENV' : os.homedir());
  const projectsDir = path.join(envRoot, '.claude', 'projects');
  const insights = [];

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
              if (text.includes('bắt buộc') || text.includes('quy chuẩn') || text.includes('rule') || text.includes('nhớ') || text.includes('yêu cầu')) {
                insights.push({ project: folder, text: text.trim().substring(0, 150) });
              }
            }
          }
        }
      } catch (e) {}
    }
  }
  return insights;
}

const res = scanSessions();
console.log(JSON.stringify(res.slice(-15), null, 2));

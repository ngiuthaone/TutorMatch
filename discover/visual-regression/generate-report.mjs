import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
const reportPath = path.join(config.outputDir, 'report.json');

if (!fs.existsSync(reportPath)) {
  console.error('Report not found. Run tests first.');
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

function getStatusClass(percentage) {
  if (percentage >= 99) return 'pass';
  if (percentage >= 95) return 'warn';
  return 'fail';
}

function getStatusLabel(percentage) {
  if (percentage >= 99) return 'PASS';
  if (percentage >= 95) return 'WARNING';
  return 'FAIL';
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Regression Test Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1600px; margin: 0 auto; }
    header { background: #1a1a2e; color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
    h1 { font-size: 1.8rem; font-weight: 600; }
    .meta { color: #aaa; margin-top: 8px; font-size: 0.9rem; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 30px; }
    .stat { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat-value { font-size: 2.5rem; font-weight: 700; color: #1a1a2e; }
    .stat-label { color: #666; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat.pass .stat-value { color: #10b981; }
    .stat.warn .stat-value { color: #f59e0b; }
    .stat.fail .stat-value { color: #ef4444; }
    table { width: 100%; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 16px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #1a1a2e; color: white; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; }
    tr:hover { background: #fafafa; }
    .page-name { font-family: monospace; font-size: 0.9rem; }
    .match-cell { display: flex; align-items: center; gap: 12px; }
    .match-bar { flex: 1; height: 8px; background: #eee; border-radius: 4px; overflow: hidden; }
    .match-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
    .match-fill.pass { background: #10b981; }
    .match-fill.warn { background: #f59e0b; }
    .match-fill.fail { background: #ef4444; }
    .match-text { font-weight: 600; font-size: 0.9rem; min-width: 60px; }
    .match-text.pass { color: #10b981; }
    .match-text.warn { color: #f59e0b; }
    .match-text.fail { color: #ef4444; }
    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .status-badge.pass { background: #d1fae5; color: #065f46; }
    .status-badge.warn { background: #fef3c7; color: #92400e; }
    .status-badge.fail { background: #fee2e2; color: #991b1b; }
    .comparison { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin: 20px 0; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .comparison img { width: 100%; height: auto; border: 1px solid #eee; border-radius: 4px; cursor: zoom-in; }
    .comparison h3 { grid-column: 1 / -1; margin-bottom: 12px; font-size: 1rem; color: #333; }
    .comparison label { font-size: 0.75rem; color: #888; display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .detail-row { display: none; }
    .detail-row.open { display: block; animation: slideDown 0.3s ease; }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    .toggle-btn { background: none; border: none; color: #6366f1; cursor: pointer; font-size: 0.85rem; padding: 4px 0; }
    .toggle-btn:hover { text-decoration: underline; }
    .diff-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 16px; font-size: 0.85rem; color: #555; }
    .diff-info span { background: #f8f9fa; padding: 8px 12px; border-radius: 4px; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 1000; justify-content: center; align-items: center; }
    .modal.open { display: flex; }
    .modal img { max-width: 95%; max-height: 95%; }
    .modal .close { position: absolute; top: 20px; right: 30px; color: white; font-size: 2rem; cursor: pointer; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Visual Regression Test Report</h1>
      <div class="meta">
        Generated: ${new Date().toLocaleString()}<br>
        Viewport: ${config.viewport.width}x${config.viewport.height} | Threshold: ${config.threshold}
      </div>
    </header>

    <div class="summary">
      <div class="stat ${results.filter(r => r.matchPercentage >= 99).length > 0 ? 'pass' : ''}">
        <div class="stat-value">${results.filter(r => r.matchPercentage >= 99).length}</div>
        <div class="stat-label">Passed (≥99%)</div>
      </div>
      <div class="stat ${results.filter(r => r.matchPercentage >= 95 && r.matchPercentage < 99).length > 0 ? 'warn' : ''}">
        <div class="stat-value">${results.filter(r => r.matchPercentage >= 95 && r.matchPercentage < 99).length}</div>
        <div class="stat-label">Warning (95-99%)</div>
      </div>
      <div class="stat ${results.filter(r => r.matchPercentage < 95).length > 0 ? 'fail' : ''}">
        <div class="stat-value">${results.filter(r => r.matchPercentage < 95).length}</div>
        <div class="stat-label">Failed (<95%)</div>
      </div>
      <div class="stat">
        <div class="stat-value">${results.length}</div>
        <div class="stat-label">Total Pages</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Page</th>
          <th>Match</th>
          <th>Status</th>
          <th>Diff Pixels</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${results.map((r, i) => {
          const statusClass = getStatusClass(r.matchPercentage);
          const statusLabel = getStatusLabel(r.matchPercentage);
          return `
        <tr>
          <td class="page-name">${r.page}</td>
          <td class="match-cell">
            <div class="match-bar">
              <div class="match-fill ${statusClass}" style="width: ${r.matchPercentage}%"></div>
            </div>
            <span class="match-text ${statusClass}">${r.matchPercentage}%</span>
          </td>
          <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
          <td>${r.diffPixels.toLocaleString()} / ${r.totalPixels.toLocaleString()}</td>
          <td>
            <button class="toggle-btn" onclick="toggleDetail(${i})">Show Comparison</button>
          </td>
        </tr>
        <tr class="detail-row" id="detail-${i}">
          <td colspan="5">
            <div class="comparison">
              <h3>${r.page}</h3>
              <div>
                <label>Test Harness</label>
                <img src="file://${r.harnessPath}" alt="Test Harness" onclick="openModal(this.src)">
              </div>
              <div>
                <label>React App</label>
                <img src="file://${r.reactPath}" alt="React App" onclick="openModal(this.src)">
              </div>
              <div>
                <label>Diff</label>
                <img src="file://${r.diffPath}" alt="Diff" onclick="openModal(this.src)">
              </div>
              <div class="diff-info">
                <span>Match: ${r.matchPercentage}%</span>
                <span>Diff Pixels: ${r.diffPixels.toLocaleString()}</span>
                <span>Total Pixels: ${r.totalPixels.toLocaleString()}</span>
                <span>Threshold: ${r.threshold}</span>
              </div>
            </div>
          </td>
        </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>

  <div class="modal" id="modal" onclick="closeModal()">
    <span class="close">&times;</span>
    <img id="modal-img" src="" alt="Full size">
  </div>

  <script>
    function toggleDetail(index) {
      const row = document.getElementById('detail-' + index);
      const btn = row.previousElementSibling.querySelector('.toggle-btn');
      row.classList.toggle('open');
      btn.textContent = row.classList.contains('open') ? 'Hide Comparison' : 'Show Comparison';
    }
    
    function openModal(src) {
      document.getElementById('modal-img').src = src;
      document.getElementById('modal').classList.add('open');
    }
    
    function closeModal() {
      document.getElementById('modal').classList.remove('open');
    }
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>`;

const outputPath = path.join(config.outputDir, 'report.html');
fs.writeFileSync(outputPath, html);
console.log(`HTML report generated: ${outputPath}`);

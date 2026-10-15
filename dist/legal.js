(() => {
  const status = document.getElementById('saved-status');
  const button = document.getElementById('clear-favorites');
  const scoresStatus = document.getElementById('scores-status');
  const scoresButton = document.getElementById('clear-records');
  if (!status || !button) return;
  function update() {
    try {
      const value = JSON.parse(localStorage.getItem('apina-favorites') || '[]');
      const count = Array.isArray(value) ? value.length : 0;
      status.textContent = `${count} ${count === 1 ? 'game saved' : 'games saved'} in this browser.`;
      const records = JSON.parse(localStorage.getItem('apina-game-records') || '{}') || {};
      const apex=JSON.parse(localStorage.getItem('apina-apex-records')||'{}');
      const scores = (typeof records === 'object' && !Array.isArray(records) ? Object.keys(records).length : 0)+(apex&&typeof apex==='object'&&Object.keys(apex).length?1:0);
      const enabled = localStorage.getItem('apina-score-preference') === 'yes';
      if (scoresStatus) scoresStatus.textContent = `${scores} ${scores === 1 ? 'game has' : 'games have'} stored scores. Score storage is ${enabled ? 'enabled' : 'disabled'}.`;
    } catch {
      status.textContent = 'Saved-game storage is unavailable or could not be read in this browser.';
      if (scoresStatus) scoresStatus.textContent = 'Browser storage is unavailable or could not be read.';
    }
  }
  button.addEventListener('click', () => {
    try {
      localStorage.removeItem('apina-favorites');
      update();
      document.getElementById('clear-status').textContent = 'Saved games cleared for this browser and site address.';
    } catch {
      document.getElementById('clear-status').textContent = 'Storage could not be cleared. Use your browser’s site-data settings instead.';
    }
  });
  scoresButton?.addEventListener('click', () => {
    try {
      localStorage.removeItem('apina-game-records');
      localStorage.removeItem('apina-apex-records');
      localStorage.removeItem('apina-score-preference');
      update();
      document.getElementById('records-clear-status').textContent = 'Stored scores deleted and score-storage choice withdrawn on this device.';
    } catch {
      document.getElementById('records-clear-status').textContent = 'Storage could not be cleared. Use your browser’s site-data settings instead.';
    }
  });
  window.addEventListener('storage', update);
  update();
})();

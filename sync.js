class CloudSync {
  constructor() {
    // Génère ou récupère un identifiant unique pour l'appareil
    this.deviceId = localStorage.getItem('bac2027_device_id') || 'dev_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('bac2027_device_id', this.deviceId);
    this.endpoint = '/.netlify/functions/sync-blobs';
  }

  async sync() {
    try {
      const localData = localStorage.getItem('bac2027_data');
      const localTimestamp = parseInt(localStorage.getItem('bac2027_last_sync') || '0', 10);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: this.deviceId,
          timestamp: localTimestamp,
          payload: localData ? JSON.parse(localData) : null
        })
      });

      if (!response.ok) return;

      const cloudData = await response.json();

      // Si le cloud contient une version plus récente, on met à jour le localStorage local
      if (cloudData && cloudData.timestamp > localTimestamp && cloudData.payload) {
        localStorage.setItem('bac2027_data', JSON.stringify(cloudData.payload));
        localStorage.setItem('bac2027_last_sync', cloudData.timestamp.toString());
        window.dispatchEvent(new CustomEvent('cloudSyncUpdated', { detail: cloudData.payload }));
      }
    } catch (err) {
      console.warn('Synchronisation hors-ligne ou interrompue:', err);
    }
  }
}

// Initialisation au chargement de la page et synchronisation toutes les 30 secondes
const cloudSync = new CloudSync();
window.addEventListener('DOMContentLoaded', () => {
  cloudSync.sync();
  setInterval(() => cloudSync.sync(), 30000);
});

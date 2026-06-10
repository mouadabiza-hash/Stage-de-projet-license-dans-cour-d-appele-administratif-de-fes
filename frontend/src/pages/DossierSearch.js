import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

function DossierSearch() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const [files, setFiles] = useState([]);         // Liste des fichiers du dossier sélectionné
  const [results, setResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFolderName, setSelectedFolderName] = useState('');
  const [selectedFileUrl, setSelectedFileUrl] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState('');

  // Nettoyer l'URL object à la fermeture
  useEffect(() => {
    return () => {
      if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl);
    };
  }, [selectedFileUrl]);

  const handleFolderSelect = (e) => {
    const inputFiles = Array.from(e.target.files);
    if (inputFiles.length === 0) return;

    // Le premier fichier contient le chemin relatif du dossier (webkitRelativePath)
    const folderName = inputFiles[0].webkitRelativePath.split('/')[0];
    setSelectedFolderName(folderName);
    setFiles(inputFiles);
    setResults([]);
    setSearchTerm('');
    setError('');
    // Optionnel : stocker le nom dans localStorage pour persistance (mais pas les fichiers)
    localStorage.setItem('selectedFolderName', folderName);
  };

  // Charger le dernier dossier sélectionné (si existant)
  useEffect(() => {
    const saved = localStorage.getItem('selectedFolderName');
    if (saved) setSelectedFolderName(saved);
  }, []);

  const handleSearch = () => {
    if (!files.length) {
      setError(t('select_folder_first') || 'Veuillez d’abord sélectionner un dossier.');
      return;
    }
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError('');
    const term = searchTerm.trim().toLowerCase();
    const filtered = files.filter(file => {
      const fileName = file.name.toLowerCase();
      const relativePath = file.webkitRelativePath.toLowerCase();
      return fileName.includes(term) || relativePath.includes(term);
    });
    setResults(filtered);
    if (filtered.length === 0) setError(t('no_results'));
    setLoading(false);
  };

  const openFile = (file) => {
    if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl);
    const url = URL.createObjectURL(file);
    setSelectedFileUrl(url);
    setSelectedFileName(file.name);
  };

  const closeViewer = () => {
    if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl);
    setSelectedFileUrl(null);
    setSelectedFileName('');
  };

  return (
    <div className="page-container">
      <h1 className="page-title">{t('dossier_search_title')}</h1>
      {error && <div className="error-message">{error}</div>}

      <div className="form-card">
        <div className="form-grid">
          <div className="form-field full-width">
            <label>{t('selected_folder')}</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                value={selectedFolderName || (files.length ? files[0]?.webkitRelativePath?.split('/')[0] : '')}
                disabled
                style={{ flex: 1 }}
                placeholder={t('no_folder_selected')}
              />
              <label className="btn-secondary" style={{ cursor: 'pointer' }}>
                {t('choose_folder')}
                <input
                  type="file"
                  webkitdirectory=""
                  directory=""
                  onChange={handleFolderSelect}
                  style={{ display: 'none' }}
                />
              </label>
              {selectedFolderName && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setFiles([]);
                    setSelectedFolderName('');
                    setResults([]);
                    setSearchTerm('');
                    localStorage.removeItem('selectedFolderName');
                  }}
                  title={t('forget_folder')}
                >
                  🗑️
                </button>
              )}
            </div>
          </div>

          <div className="form-field full-width">
            <label>{t('file_name')}</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('search_placeholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                style={{ flex: 1 }}
              />
              <button className="btn-primary" onClick={handleSearch} disabled={loading}>
                {loading ? t('searching') : t('search')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`dossier-viewer-layout ${isRtl ? 'rtl-layout' : 'ltr-layout'}`}>
        <div className="dossier-sidebar">
          <div className="data-table-wrapper" style={{ marginTop: 0 }}>
            <h3>{t('results')} ({results.length})</h3>
            {results.length === 0 && !loading && searchTerm.trim() !== '' && (
              <div className="text-muted">{t('no_results')}</div>
            )}
            {results.length > 0 && (
              <div className="dossier-file-list">
                {results.map((file, idx) => (
                  <div
                    key={idx}
                    className={`dossier-file-item ${selectedFileName === file.name ? 'active' : ''}`}
                    onClick={() => openFile(file)}
                  >
                    <span className="file-name">{file.webkitRelativePath || file.name}</span>
                    <button className="btn-secondary btn-small">{t('consulter')}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="dossier-pdf-viewer">
          {selectedFileUrl ? (
            <div className="pdf-viewer-wrapper">
              <div className="registry-panel-header">
                <h3>{selectedFileName}</h3>
                <button className="btn-secondary" onClick={closeViewer}>{t('fermer')}</button>
              </div>
              <iframe src={selectedFileUrl} title="PDF Viewer" className="pdf-iframe-full" />
            </div>
          ) : (
            <div className="text-muted" style={{ padding: '2rem' }}>
              {t('select_file_to_view')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DossierSearch;
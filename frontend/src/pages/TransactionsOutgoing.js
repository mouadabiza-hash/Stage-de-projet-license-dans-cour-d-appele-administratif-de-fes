import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

function TransactionsOutgoing() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith('ar') ? 'ar-MA' : 'fr-FR';
  const [allTransactions, setAllTransactions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    axios.get('/api/transactions/outgoing')
      .then(res => {
        const accepted = res.data.filter(tx => tx.statut?.toLowerCase().includes('accept'));
        setAllTransactions(accepted);
        setFiltered(accepted);
      })
      .catch(() => setError(t('erreur_chargement')));
  }, [t]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFiltered(allTransactions);
      return;
    }
    const term = searchTerm.toLowerCase();
    setFiltered(allTransactions.filter(tx =>
      tx.documentSujet?.toLowerCase().includes(term) ||
      tx.destinationServiceNom?.toLowerCase().includes(term) ||
      tx.numeroCourrier?.toLowerCase().includes(term) ||
      tx.numeroDossierJudiciaire?.toLowerCase().includes(term)
    ));
    setSelectedIds([]);
    setSelectAll(false);
    setCurrentPage(1); // reset page when search changes
  }, [searchTerm, allTransactions]);

  // Reset page when filtered length changes (e.g., after search)
  useEffect(() => {
    setCurrentPage(1);
  }, [filtered.length]);

  const handleSelectAll = () => {
    setSelectedIds(selectAll ? [] : filtered.map(tx => tx.id));
    setSelectAll(!selectAll);
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const exportSelected = async () => {
    if (selectedIds.length === 0) {
      alert(t('selection_requise'));
      return;
    }
    try {
      const res = await axios.post('/api/transactions/export-selected', selectedIds, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transactions_acceptees.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(t('erreur_export'));
    }
  };

  // Pagination calculations
  const indexOfLast = currentPage * rowsPerPage;
  const indexOfFirst = indexOfLast - rowsPerPage;
  const currentTransactions = filtered.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  return (
    <div className="page-container">
      <h1 className="page-title">{t('registre_transactions_acceptees')}</h1>
      {error && <div className="error-message">{error}</div>}
      <div className="filters" style={{ justifyContent: 'space-between' }}>
        <input
          type="text"
          placeholder={t('rechercher')}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ width: '250px' }}
        />
        <button className="btn-primary" onClick={exportSelected}>
          {t('exporter_selection')}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <div className="rows-per-page">
          <span>{t('afficher')}</span>
          <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
          </select>
          <span>{t('lignes')}</span>
        </div>
      </div>

      <div className="data-table-wrapper">
        <table className="modern-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input type="checkbox" checked={selectAll} onChange={handleSelectAll} />
              </th>
              <th>{t('document')}</th>
              <th>{t('numero_courrier')}</th>
              <th>{t('numero_dossier_judiciaire')}</th>
              <th>{t('service_destinataire')}</th>
              <th>{t('date_envoi')}</th>
              <th>{t('accepte_par') || 'Accepté par'}</th>
              <th>{t('date_acceptation') || 'Date acceptation'}</th>
              <th>{t('reponse_note')}</th>
            </tr>
          </thead>
          <tbody>
            {currentTransactions.map(tx => (
              <tr key={tx.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(tx.id)}
                    onChange={() => handleSelectOne(tx.id)}
                  />
                </td>
                <td>{tx.documentSujet}</td>
                <td>{tx.numeroCourrier || '-'}</td>
                <td>{tx.numeroDossierJudiciaire || '-'}</td>
                <td>{tx.destinationServiceNom}</td>
                <td>{tx.dateEnvoi ? new Date(tx.dateEnvoi).toLocaleString(locale) : '-'}</td>
                <td>{tx.acceptedByUserName || '-'}</td>
<td>{tx.acceptedDate ? new Date(tx.acceptedDate).toLocaleString(locale) : '-'}</td>
                <td>{tx.messageReponse || '-'}</td>
              </tr>
            ))}
            {currentTransactions.length === 0 && (
              <tr className="empty-row"><td colSpan="7">{t('aucune_transaction_acceptee')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
            {t('precedent')}
          </button>
          <span>{t('page')} {currentPage} / {totalPages}</span>
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
            {t('suivant')}
          </button>
        </div>
      )}
    </div>
  );
}

export default TransactionsOutgoing;
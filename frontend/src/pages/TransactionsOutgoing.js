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
    if (!searchTerm.trim()) { setFiltered(allTransactions); return; }
    const term = searchTerm.toLowerCase();
    setFiltered(allTransactions.filter(tx =>
      tx.documentSujet?.toLowerCase().includes(term) ||
      tx.destinationServiceNom?.toLowerCase().includes(term) ||
      tx.numeroCourrier?.toLowerCase().includes(term) ||
      tx.numeroDossierJudiciaire?.toLowerCase().includes(term)
    ));
    setSelectedIds([]);
    setSelectAll(false);
  }, [searchTerm, allTransactions]);

  const handleSelectAll = () => {
    setSelectedIds(selectAll ? [] : filtered.map(tx => tx.id));
    setSelectAll(!selectAll);
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const exportSelected = async () => {
    if (!selectedIds.length) { alert(t('selection_requise')); return; }
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

  return (
    <div className="page-container">
      <h1 className="page-title">{t('registre_transactions_acceptees')}</h1>
      {error && <div className="error-message">{error}</div>}
      <div className="filters">
        <input type="text" placeholder={t('rechercher')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <button className="btn-primary" onClick={exportSelected}>{t('exporter_selection')}</button>
      </div>
      <div className="data-table-wrapper">
        <table className="modern-table">
          <thead>
            <tr><th style={{ width: '40px' }}><input type="checkbox" checked={selectAll} onChange={handleSelectAll} /></th>
              <th>{t('document')}</th><th>{t('numero_courrier')}</th><th>{t('numero_dossier_judiciaire')}</th>
              <th>{t('service_destinataire')}</th><th>{t('date_envoi')}</th><th>{t('reponse_note')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(tx => (
              <tr key={tx.id}>
                <td><input type="checkbox" checked={selectedIds.includes(tx.id)} onChange={() => handleSelectOne(tx.id)} /></td>
                <td>{tx.documentSujet}</td><td>{tx.numeroCourrier || '-'}</td><td>{tx.numeroDossierJudiciaire || '-'}</td>
                <td>{tx.destinationServiceNom}</td><td>{new Date(tx.dateEnvoi).toLocaleString(locale)}</td><td>{tx.messageReponse || '-'}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan="7">{t('aucune_transaction_acceptee')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default TransactionsOutgoing;
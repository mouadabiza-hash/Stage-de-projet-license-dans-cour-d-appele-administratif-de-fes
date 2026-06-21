import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';

function TransactionsOutgoing() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useModal();
  const locale = i18n.resolvedLanguage?.startsWith('ar') ? 'ar-MA' : 'fr-FR';
  const isAdmin = user?.role === 'Admin';

  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('sent');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');

  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2019 }, (_, i) => 2020 + i);
  const months = [
    { value: 1, label: 'جانفي' }, { value: 2, label: 'فيفري' }, { value: 3, label: 'مارس' },
    { value: 4, label: 'أفريل' }, { value: 5, label: 'ماي' }, { value: 6, label: 'جوان' },
    { value: 7, label: 'جويلية' }, { value: 8, label: 'أوت' }, { value: 9, label: 'سبتمبر' },
    { value: 10, label: 'أكتوبر' }, { value: 11, label: 'نوفمبر' }, { value: 12, label: 'ديسمبر' }
  ];

  useEffect(() => {
    if (isAdmin && viewMode === 'byService' && services.length === 0) fetchServices();
  }, [isAdmin, viewMode]);

  useEffect(() => {
    fetchTransactions();
  }, [selectedYear, selectedMonth, viewMode, selectedServiceId]);

  const fetchServices = async () => {
    try {
      const res = await axios.get('/api/transactions/services-list');
      setServices(res.data);
    } catch (err) {}
  };

  const fetchTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      let data = [];
      if (viewMode === 'sent') {
        const res = await axios.get('/api/transactions/outgoing', {
          params: { year: selectedYear || undefined, month: selectedMonth || undefined }
        });
        data = res.data;
      } else if (viewMode === 'all') {
        const [outgoingRes, incomingRes] = await Promise.all([
          axios.get('/api/transactions/outgoing', { params: { year: selectedYear || undefined, month: selectedMonth || undefined } }),
          axios.get('/api/transactions/incoming-accepted', { params: { year: selectedYear || undefined, month: selectedMonth || undefined } })
        ]);
        data = [...outgoingRes.data, ...incomingRes.data];
        // Remove duplicates (if any)
        data = data.filter((tx, idx, self) => self.findIndex(t => t.id === tx.id) === idx);
      } else if (viewMode === 'byService' && isAdmin && selectedServiceId) {
        const res = await axios.get('/api/transactions/by-service-all', {
          params: { serviceId: selectedServiceId, year: selectedYear || undefined, month: selectedMonth || undefined }
        });
        data = res.data;
      }

      // Sort by date: for accepted transactions use acceptedDate, otherwise use dateEnvoi
      data.sort((a, b) => {
        const timeA = a.acceptedDate ? new Date(a.acceptedDate).getTime() : new Date(a.dateEnvoi).getTime();
        const timeB = b.acceptedDate ? new Date(b.acceptedDate).getTime() : new Date(b.dateEnvoi).getTime();
        return timeB - timeA;
      });

      setTransactions(data);
      setFilteredTransactions(data);
      setSelectedIds([]);
      setSelectAll(false);
      setCurrentPage(1);
    } catch (err) {
      setError(t('erreur_chargement'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) setSelectedIds([]);
    else setSelectedIds(filteredTransactions.map(t => t.id));
    setSelectAll(!selectAll);
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
    setSelectAll(false);
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    if (mode !== 'byService') setSelectedServiceId('');
  };
  const handleServiceChange = (e) => setSelectedServiceId(e.target.value);
  const handleYearChange = (e) => setSelectedYear(e.target.value);
  const handleMonthChange = (e) => setSelectedMonth(e.target.value);

  const exportSelectedTransactions = async () => {
    if (selectedIds.length === 0) {
      showAlert(t('selection_requise'), t('attention'));
      return;
    }
    try {
      const response = await axios.post('/api/transactions/export-selected', selectedIds, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'transactions_acceptees.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(t('erreur_export'));
    }
  };

  const indexOfLast = currentPage * rowsPerPage;
  const indexOfFirst = indexOfLast - rowsPerPage;
  const currentTransactions = filteredTransactions.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredTransactions.length / rowsPerPage);
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  return (
    <div className="page-container">
      <h1 className="page-title">{t('registre_transactions_acceptees')}</h1>
      {error && <div className="error-message">{error}</div>}
      <div className="filters" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className={viewMode === 'sent' ? 'btn-primary' : 'btn-secondary'} onClick={() => handleViewModeChange('sent')}>
            {t('mes_transactions_envoyees') || 'معاملاتي'}
          </button>
          <button className={viewMode === 'all' ? 'btn-primary' : 'btn-secondary'} onClick={() => handleViewModeChange('all')}>
            {t('toutes_mes_transactions') || 'كل معاملاتي'}
          </button>
          {isAdmin && (
            <button className={viewMode === 'byService' ? 'btn-primary' : 'btn-secondary'} onClick={() => handleViewModeChange('byService')}>
              {t('afficher_par_service') || 'عرض حسب الخدمة'}
            </button>
          )}
          {isAdmin && viewMode === 'byService' && (
            <select value={selectedServiceId} onChange={handleServiceChange} style={{ minWidth: '200px' }}>
              <option value="">{t('choisir_service')}</option>
              {services.map(s => <option key={s.idService} value={s.idService}>{s.nomService}</option>)}
            </select>
          )}
          <select value={selectedYear} onChange={handleYearChange}>
            <option value="">{t('toutes_annees')}</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={selectedMonth} onChange={handleMonthChange}>
            <option value="">{t('tous_mois')}</option>
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn-primary" onClick={exportSelectedTransactions}>
            📊 {t('exporter_selection')}
          </button>
          <div className="rows-per-page">
            <span>{t('afficher')}</span>
            <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
            <span>{t('lignes')}</span>
          </div>
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
              {user?.role === 'Greffier' && <th>{t('numero_courrier')}</th>}
              <th>{t('numero_dossier_judiciaire')}</th>
              {viewMode === 'byService' && <th>{t('service_source')}</th>}
              <th>{t('service_destinataire')}</th>
              <th>{t('date_envoi')}</th>
              <th>{t('accepte_par')}</th>
              <th>{t('date_acceptation')}</th>
              <th>{t('reponse_note')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={viewMode === 'byService' ? (user?.role === 'Greffier' ? 10 : 9) : (user?.role === 'Greffier' ? 9 : 8)} className="loading">{t('chargement')}</td></tr>
            ) : currentTransactions.length === 0 ? (
              <tr><td colSpan={viewMode === 'byService' ? (user?.role === 'Greffier' ? 10 : 9) : (user?.role === 'Greffier' ? 9 : 8)} className="text-muted">{t('aucune_transaction_acceptee')}</td></tr>
            ) : (
              currentTransactions.map(tx => (
                <tr key={tx.id}>
                  <td>
                    <input type="checkbox" checked={selectedIds.includes(tx.id)} onChange={() => handleSelectOne(tx.id)} />
                  </td>
                  <td>{tx.documentSujet}</td>
                  {user?.role === 'Greffier' && <td>{tx.numeroCourrier || '-'}</td>}
                  <td>{tx.numeroDossierJudiciaire || '-'}</td>
                  {viewMode === 'byService' && <td className="source-service">{tx.sourceServiceNom || '-'}</td>}
                  <td className="dest-service">{tx.destinationServiceNom}</td>
                  <td>{new Date(tx.dateEnvoi).toLocaleString(locale)}</td>
                  <td>{tx.acceptedByUserName || '-'}</td>
                  <td>{tx.acceptedDate ? new Date(tx.acceptedDate).toLocaleString(locale) : '-'}</td>
                  <td>{tx.messageReponse || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>{t('precedent')}</button>
          <span>{t('page')} {currentPage} / {totalPages}</span>
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>{t('suivant')}</button>
        </div>
      )}
    </div>
  );
}

export default TransactionsOutgoing;
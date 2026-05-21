import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

function TransactionsOutgoing() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const locale = i18n.resolvedLanguage?.startsWith('ar') ? 'ar-MA' : 'fr-FR';
  const isAdmin = user?.role === 'Admin';

  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [viewMode, setViewMode] = useState('myService'); // 'myService' or 'byService'
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Generate available years from 2020 to current year + 1
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2019 }, (_, i) => 2020 + i);
  const months = [
    { value: 1, label: 'جانفي' }, { value: 2, label: 'فيفري' }, { value: 3, label: 'مارس' },
    { value: 4, label: 'أفريل' }, { value: 5, label: 'ماي' }, { value: 6, label: 'جوان' },
    { value: 7, label: 'جويلية' }, { value: 8, label: 'أوت' }, { value: 9, label: 'سبتمبر' },
    { value: 10, label: 'أكتوبر' }, { value: 11, label: 'نوفمبر' }, { value: 12, label: 'ديسمبر' }
  ];

  useEffect(() => {
    if (isAdmin && viewMode === 'byService' && services.length === 0) {
      fetchServices();
    }
  }, [isAdmin, viewMode]);

  useEffect(() => {
    fetchTransactions();
  }, [selectedYear, selectedMonth, viewMode, selectedServiceId]);

  const fetchServices = async () => {
    try {
      const res = await axios.get('/api/transactions/services-list');
      setServices(res.data);
    } catch (err) {
      console.error('Failed to fetch services', err);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      let res;
      if (viewMode === 'byService' && isAdmin && selectedServiceId) {
        // Fetch by service
        let url = `/api/transactions/by-service?serviceId=${selectedServiceId}`;
        if (selectedYear) url += `&year=${selectedYear}`;
        if (selectedMonth) url += `&month=${selectedMonth}`;
        res = await axios.get(url);
      } else {
        // Fetch my outgoing transactions
        let url = '/api/transactions/outgoing';
        const params = new URLSearchParams();
        if (selectedYear) params.append('year', selectedYear);
        if (selectedMonth) params.append('month', selectedMonth);
        if (params.toString()) url += `?${params.toString()}`;
        res = await axios.get(url);
      }
      setTransactions(res.data);
      setFilteredTransactions(res.data);
      setCurrentPage(1);
    } catch (err) {
      setError(t('erreur_chargement'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedYear, selectedMonth, viewMode, selectedServiceId]);

  // Pagination calculations
  const indexOfLast = currentPage * rowsPerPage;
  const indexOfFirst = indexOfLast - rowsPerPage;
  const currentTransactions = filteredTransactions.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredTransactions.length / rowsPerPage);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  const handleYearChange = (e) => {
    setSelectedYear(e.target.value);
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    if (mode === 'myService') {
      setSelectedServiceId('');
    }
  };

  const handleServiceChange = (e) => {
    setSelectedServiceId(e.target.value);
  };

  return (
    <div className="page-container">
      <h1 className="page-title">{t('registre_transactions_acceptees')}</h1>
      {error && <div className="error-message">{error}</div>}

      {/* Filters Bar */}
      <div className="filters" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Year Filter */}
          <select value={selectedYear} onChange={handleYearChange} style={{ minWidth: '100px' }}>
            <option value="">{t('toutes_annees') || 'الكل'}</option>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          {/* Month Filter */}
          <select value={selectedMonth} onChange={handleMonthChange} style={{ minWidth: '120px' }}>
            <option value="">{t('tous_mois') || 'الكل'}</option>
            {months.map(month => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>

          {/* View Mode Buttons (Admin only) */}
          {isAdmin && (
            <>
              <button
                className={viewMode === 'myService' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => handleViewModeChange('myService')}
              >
                {t('mes_transactions') || 'معاملاتي'}
              </button>
              <button
                className={viewMode === 'byService' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => handleViewModeChange('byService')}
              >
                {t('afficher_par_service') || 'عرض حسب الخدمة'}
              </button>
            </>
          )}

          {/* Service Selector (when in byService mode) */}
          {isAdmin && viewMode === 'byService' && (
            <select value={selectedServiceId} onChange={handleServiceChange} style={{ minWidth: '200px' }}>
              <option value="">{t('choisir_service') || 'اختر خدمة'}</option>
              {services.map(s => (
                <option key={s.idService} value={s.idService}>{s.nomService}</option>
              ))}
            </select>
          )}
        </div>

        {/* Rows per page */}
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

      {/* Table */}
      <div className="data-table-wrapper">
        <table className="modern-table">
          <thead>
            <tr>
              <th>{t('document')}</th>
              <th>{t('numero_courrier')}</th>
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
              <tr><td colSpan={viewMode === 'byService' ? 9 : 8} className="loading">{t('chargement')}</td></tr>
            ) : currentTransactions.length === 0 ? (
              <tr><td colSpan={viewMode === 'byService' ? 9 : 8} className="text-muted">{t('aucune_transaction_acceptee')}</td></tr>
            ) : (
              currentTransactions.map(tx => (
                <tr key={tx.id}>
                  <td>{tx.documentSujet}</td>
                  <td>{tx.numeroCourrier || '-'}</td>
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

      {/* Pagination */}
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
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import DocumentModal from '../components/DocumentModal';

const TYPE_ADMINISTRATIF = 'administratif';
const TYPE_JUDICIAIRE = 'judiciaire';
const TYPE_SORTANT = 'sortant';

function GestionCourriers() {

  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { user } = useAuth();
  const perms = usePermissions();
  const serviceId = user?.idService;
  const currentYear = new Date().getFullYear().toString();
  const isGreffier = user?.role === 'Greffier';
  const isAdmin = user?.role === 'Admin';
  const userRole = user?.role;

 const [allDocs, setAllDocs] = useState([]);


  const isEnregistrement = userRole === 'Enregistrement';
  const isProcedures = userRole === 'Procedures';

  // Role‑based document filter
  let filterMode = 'all';
  if (isEnregistrement || isProcedures) filterMode = 'without';
  if (isGreffier) filterMode = 'with';

  const showAdministratif = perms.canCreateAdministratif;
  const showSortant = perms.canCreateAdministratif;
  const showJudiciaire = perms.canCreateJuridique || perms.canCreateLinked;

  const [tab, setTab] = useState(() => {
    if (isProcedures || isEnregistrement) return TYPE_JUDICIAIRE;
    if (perms.canCreateAdministratif) return TYPE_ADMINISTRATIF;
    if (perms.canCreateJuridique) return TYPE_JUDICIAIRE;
    return TYPE_ADMINISTRATIF;
  });

  const [judMode, setJudMode] = useState(() => {
    if (isProcedures) return 'linked';
    return 'file';
  });
  const [sourceOptions, setSourceOptions] = useState([]);
  const [pdfMessage, setPdfMessage] = useState({ text: '', type: '' });

  const [errorMessage, setErrorMessage] = useState({ text: '', visible: false });

  // ---------- data ----------
  const [services, setServices] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ---------- form ----------
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(emptyForm(tab));
  const [parentFiles, setParentFiles] = useState([]);

  // ---------- reply / answer ----------
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyForm, setReplyForm] = useState({
    destinataire: '',
    sujet: '',
    date: new Date().toISOString().slice(0, 10),
    lienPdf: '',
    description: ''
  });
  const [uploadingReply, setUploadingReply] = useState(false);

  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [answerTarget, setAnswerTarget] = useState(null);
  const [answerForm, setAnswerForm] = useState({
    source: '',
    sujet: '',
    date: new Date().toISOString().slice(0, 10),
    lienPdf: '',
    description: '',
    estTransmissible: false
  });
  const [uploadingAnswer, setUploadingAnswer] = useState(false);

  const [showViewReplyModal, setShowViewReplyModal] = useState(false);
  const [viewedReply, setViewedReply] = useState(null);
  const [editingReply, setEditingReply] = useState(false);
  const [editReplyForm, setEditReplyForm] = useState({});

  // ---------- transfer ----------
  const [showTransferChoice, setShowTransferChoice] = useState(false);
  const [transferChoiceDoc, setTransferChoiceDoc] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferSelections, setTransferSelections] = useState([]);
  const [transferCurrentService, setTransferCurrentService] = useState('');
  const [transferCurrentUserIds, setTransferCurrentUserIds] = useState([]);
  const [transferMessage, setTransferMessage] = useState('');
  const [transferDoitRevenir, setTransferDoitRevenir] = useState(false);
  const [showSingleTransferModal, setShowSingleTransferModal] = useState(false);
  const [singleTransferTarget, setSingleTransferTarget] = useState(null);
  const [singleTransferServiceId, setSingleTransferServiceId] = useState('');
  const [singleTransferUsers, setSingleTransferUsers] = useState([]);
  const [singleTransferUserId, setSingleTransferUserId] = useState('');
  const [singleTransferDoitRevenir, setSingleTransferDoitRevenir] = useState(false);
  const [singleTransferMessage, setSingleTransferMessage] = useState('');
  const [singleTransferDocType, setSingleTransferDocType] = useState('Judiciaire');

  // ---------- history / withdrawals ----------
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTransactions, setHistoryTransactions] = useState([]);
  const [historyDocumentTitle, setHistoryDocumentTitle] = useState('');

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawDocumentTitle, setWithdrawDocumentTitle] = useState('');

  // ---------- document modal ----------
  const [showDocModal, setShowDocModal] = useState(false);
  const [currentDocument, setCurrentDocument] = useState(null);

  // ---------- misc ----------
  const [repliedIds, setRepliedIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  // ---------- column visibility ----------
  const defaultColumns = {
    idBureauOrdre: true,
    dateMessage: true,
    numeroCourrier: true,
    dateArrival: true,
    subject: true,
    type: true,
    source: true,
    destinataire: true,
    etat: true,
    emplacement: true,
    pdf: true,
    actions: true,
    // reponse 
 replyInfo: true,
  };

  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('courriers_visible_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultColumns, ...parsed };
      } catch {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  //-----------------message de succes ----------------------
  const [successMessage, setSuccessMessage] = useState({ text: '', visible: false });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  // ---------- Confirmation du numero internn ----------------
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
const [duplicateMessage, setDuplicateMessage] = useState('');
const [pendingSubmit, setPendingSubmit] = useState(null);
  // ---------- dynamic lists ----------
  const [documentStates, setDocumentStates] = useState([]);
  const [tribunalTypes, setTribunalTypes] = useState([]);
  const [judicialTypes, setJudicialTypes] = useState([]);

  // ========== IMPORT WIZARD ==========
  const [showImportTypeModal, setShowImportTypeModal] = useState(false);
  const [selectedImportType, setSelectedImportType] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const importFileInputRef = useRef(null);

  const importTypes = [
    { value: 'administratif_entrant', label: 'الواردات الإدارية (Courriers Administratifs Entrants)', template: '/api/courriers/template-excel?type=administratif', icon: '📨' },
    { value: 'judiciaire_file', label: 'الملفات القضائية (Dossiers Judiciaires)', template: '/api/courriers/template-excel?type=judiciaire_file', icon: '⚖️' },
    { value: 'judiciaire_linked', label: 'الوثائق المرتبطة (Documents Liés)', template: '/api/courriers/template-excel?type=judiciaire_linked', icon: '🔗' },
    { value: 'sortant', label: 'الصادرات (Courriers Sortants)', template: '/api/courriers/template-excel?type=sortant', icon: '📤' }
  ];

  const requiredColumnsMap = {
    administratif_entrant: ['serialNumber', 'subject', 'senderName', 'arrivalDate', 'resultNote', 'number', 'letterDate'],
    judiciaire_file: ['serialNumber', 'subject', 'tribunalSource', 'date', 'numeroDossier', 'numeroPremiereInstance', 'description'],
    judiciaire_linked: ['serialNumber', 'subject', 'parentJudiciaireId', 'date', 'description'],
    sortant: ['serialNumber', 'subject', 'destinataire', 'date', 'resultNote', 'number']
  };

  // ---------- fetch lists ----------
  useEffect(() => {
    const fetchLists = async () => {
    
      try {
        const [statesRes, tribunalRes, judicialRes ,sourceRes ] = await Promise.all([
          axios.get('/api/ListItems?listName=DocumentState'),
          axios.get('/api/ListItems?listName=TribunalType'),
          axios.get('/api/ListItems?listName=JudicialType'),
          axios.get('/api/ListItems?listName=Source')
        ]);
        setDocumentStates(statesRes.data.sort((a, b) => a.displayOrder - b.displayOrder));
        setTribunalTypes(tribunalRes.data.sort((a, b) => a.displayOrder - b.displayOrder));
        setJudicialTypes(judicialRes.data.sort((a, b) => a.displayOrder - b.displayOrder));
        setSourceOptions(sourceRes.data.sort((a, b) => a.displayOrder - b.displayOrder));
      } catch (err) { console.error('Failed to load lists', err); }
    };
    fetchLists();
  }, []);

  useEffect(() => {
    localStorage.setItem('courriers_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = (col) => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));

  const handleSelectAll = () => {
    if (selectAll) setSelectedRowIds([]);
    else setSelectedRowIds(currentItems.map(doc => doc.id));
    setSelectAll(!selectAll);
  };
  const handleSelectRow = (id) => {
    setSelectedRowIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    setSelectAll(false);
  };

  function emptyForm(type) {
    return {
      idBureauOrdre: '', date: '', source: '', sujet: '', destinataire: '', description: '',
      etat: 'Nouveau', lienPdf: '', idService: serviceId || '', estTransmissible: type !== TYPE_SORTANT,
      numeroDeCourrier: '', tribunalSource: '', typeJudiciaire: '', numeroPremiereInstance: '',
      destinataireSortant: '', estDocumentLie: false, parentJudiciaireId: '', dateMessage: '', dateArrivee: '', numeroDossier: ''
    };
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [courriersRes, servicesRes, usersRes] = await Promise.all([
        axios.get('/api/courriers'),
        axios.get('/api/services'),
        axios.get('/api/utilisateurs')
      ]);
      setAllDocs(courriersRes.data);
      setServices(servicesRes.data);
      setAllUsers(usersRes.data);
      const ids = new Set();
      courriersRes.data.forEach(d => { if (d.parentId) ids.add(Number(d.parentId)); });
      setRepliedIds(ids);
      setError('');
    } catch (err) {
      showError(getErrorMessage(err, t('erreur_chargement')));
    } finally {
      setLoading(false);
    }
  }, [t]);
  const showError = (text) => {
  setErrorMessage({ text, visible: true });
  setTimeout(() => setErrorMessage(prev => ({ ...prev, visible: false })), 6000);
};

  const showSuccess = (text) => {
  setSuccessMessage({ text, visible: true });
  // Auto-hide after 5 seconds
  setTimeout(() => {
    setSuccessMessage(prev => ({ ...prev, visible: false }));
  }, 5000);
};
  const fetchParentFiles = useCallback(async () => {
    try {
      const res = await axios.get('/api/acteursjudiciaires/parents');
      setParentFiles(res.data);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const mainDocs = useMemo(() => allDocs.filter(d => !d.parentId), [allDocs]);
const filtered = useMemo(() => {
  let docs = mainDocs;
  if (filterMode === 'without') docs = docs.filter(d => !d.idBureauOrdre || d.idBureauOrdre.trim() === '');
  else if (filterMode === 'with') docs = docs.filter(d => d.idBureauOrdre && d.idBureauOrdre.trim() !== '');
  
  if (search.trim()) {
    const kw = search.toLowerCase();
    docs = docs.filter(d =>
      (d.idBureauOrdre || '').toLowerCase().includes(kw) ||
      (d.sujet || '').toLowerCase().includes(kw) ||
      (d.source || d.tribunalSource || '').toLowerCase().includes(kw) ||
      (d.destinataire || '').toLowerCase().includes(kw)
    );
  }
  
  // DESCENDING sort: largest number first
  return [...docs].sort((a, b) => {
    const getNum = (val) => {
      if (!val) return -1;
      const parts = String(val).split('/');
      const num = parseInt(parts[0], 10);
      return isNaN(num) ? -1 : num;
    };
    const numA = getNum(a.idBureauOrdre);
    const numB = getNum(b.idBureauOrdre);
    // Items without idBureauOrdre go to the bottom
    if (numA === -1 && numB === -1) return 0;
    if (numA === -1) return 1;
    if (numB === -1) return -1;
    return numB - numA; // descending
  });
}, [mainDocs, filterMode, search]);

  const idxLast = page * rowsPerPage;
  const idxFirst = idxLast - rowsPerPage;
  const currentItems = filtered.slice(idxFirst, idxLast);
  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  useEffect(() => { setPage(1); }, [search]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : name === 'idService' ? Number(value) : value,
    }));
  };

  const resetForm = () => { setEditingId(null); setForm(emptyForm(tab)); setError(''); setSuccess(''); };
  const switchTab = (type) => {
    setTab(type);
    resetForm();
    if (isProcedures) setJudMode('linked');
    else if (isEnregistrement) setJudMode('file');
    else setJudMode('file');
    window.scrollTo({ top: 0 });
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  
  // If duplicate found, show warning modal and store submit action
  if (isDuplicateNumeroSource()) {
    setDuplicateMessage(t('duplicate_numero_source_warning') || 'هذا الرقم مع هذا المصدر موجود مسبقاً. هل تريد الحفظ رغم ذلك؟');
    setShowDuplicateWarning(true);
    // Store the event so we can retry after confirmation
    setPendingSubmit(() => async () => {
      await performSubmit();
    });
    return;
  }
  
  await performSubmit();
};

const performSubmit = async () => {
  if (!perms.canCreateAdministratif && !perms.canCreateJuridique && !perms.canCreateLinked) return;
  setError(''); setSuccess('');
  try {
    if (tab === TYPE_ADMINISTRATIF || tab === TYPE_SORTANT) {
      let bureauOrdre = (form.idBureauOrdre || '').trim();
      if (bureauOrdre && !bureauOrdre.includes('/')) bureauOrdre = `${bureauOrdre}/${currentYear}`;
      let mainDate = tab === TYPE_SORTANT ? form.date : (form.dateArrivee || form.date);
      let description = form.description?.trim() || '';
      if (tab === TYPE_ADMINISTRATIF && form.dateMessage) {
        description = `تاريخ الرسالة: ${form.dateMessage}` + (description ? ` | ${description}` : '');
      }
      const destinataire = tab === TYPE_ADMINISTRATIF ? 'محكمة الاستئناف' : form.destinataireSortant.trim();
      const payload = {
        idBureauOrdre: bureauOrdre,
        date: new Date(mainDate).toISOString(),
        source: tab === TYPE_SORTANT ? 'Sortant' : form.source.trim(),
        sujet: form.sujet.trim(),
        destinataire,
        description,
        etat: 'Nouveau',
        lienPdf: form.lienPdf.trim(),
        direction: tab === TYPE_SORTANT ? 'Sortant' : 'Entrant',
        typeRegistre: tab === TYPE_SORTANT ? 'Morasalat' : 'Waridat',
        typeCorrespondance: tab === TYPE_SORTANT ? 'Sortante' : null,
        parentId: null,
        idService: Number(form.idService),
        numeroDeCourrier: form.numeroDeCourrier?.trim() || '',
        estTransmissible: tab === TYPE_SORTANT ? false : Boolean(form.estTransmissible),
      };
      if (editingId) await axios.put(`/api/courriers/${editingId}`, payload);
      else await axios.post('/api/courriers', payload);
      } else if (tab === TYPE_JUDICIAIRE) {
        let bureauOrdre = (form.idBureauOrdre || '').trim();
        if (bureauOrdre && !bureauOrdre.includes('/')) bureauOrdre = `${bureauOrdre}/${currentYear}`;
        const payload = {
          idBureauOrdre: bureauOrdre || null,
          date: new Date(form.date).toISOString(),
          tribunalSource: form.tribunalSource.trim(),
          sujet: form.sujet.trim(),
          direction: 'Entrant',
          description: form.description?.trim() || '',
          etatArchive: form.etat,
          lienPdf: form.lienPdf.trim(),
          idService: Number(form.idService),
          estTransmissible: true,
          numeroPremiereInstance: form.numeroPremiereInstance?.trim() || null,
          estDocumentLie: judMode === 'linked',
          parentJudiciaireId: judMode === 'linked' ? Number(form.parentJudiciaireId) : null,
          destinataire: 'محكمة الاستئناف',
          numeroDossier: judMode === 'linked' ? null : form.numeroDossier
        };
        if (editingId) await axios.put(`/api/acteursjudiciaires/${editingId}`, payload);
        else await axios.post('/api/acteursjudiciaires', payload);
      }
      showSuccess(editingId ? t('modification_succes') : t('ajout_succes'));
      resetForm();
      fetchData();
    } catch (err) { showError(getErrorMessage(err, t('erreur_enregistrement'))); }
  };

  const isDuplicateNumeroSource = () => {
  // Only check for administrative or outgoing documents
  if (tab !== TYPE_ADMINISTRATIF && tab !== TYPE_SORTANT) return false;
  
  const currentNumero = form.numeroDeCourrier?.trim();
  const currentSource = form.source?.trim();
  
  // Both fields must be filled to be considered
  if (!currentNumero || !currentSource) return false;
  
  return allDocs.some(doc => 
    doc.typeDocument === 'Administratif' &&      // only administrative docs
    doc.numeroDeCourrier?.trim().toLowerCase() === currentNumero.toLowerCase() &&
    doc.source?.trim().toLowerCase() === currentSource.toLowerCase() &&
    doc.id !== editingId                         // exclude current document when editing
  );
};
  const handleEdit = (doc) => {
    if (!perms.canCreateAdministratif && !perms.canCreateJuridique && !perms.canCreateLinked) return;
    let type;
    if (doc.typeDocument === 'Judiciaire') type = TYPE_JUDICIAIRE;
    else if (doc.typeRegistre === 'Morasalat' && doc.typeCorrespondance === 'Sortante') type = TYPE_SORTANT;
    else type = TYPE_ADMINISTRATIF;
    setTab(type);
    setEditingId(doc.id);
    setJudMode(doc.estDocumentLie ? 'linked' : 'file');
    const idNum = (doc.idBureauOrdre || '').split('/')[0];
    let dateMessage = '';
    const desc = doc.description || '';
    const match = desc.match(/تاريخ الرسالة:\s*(\S+)/);
    if (match) dateMessage = match[1];
    setForm({
      ...emptyForm(type),
      idBureauOrdre: idNum || '',
      date: doc.date ? doc.date.slice(0, 10) : '',
      source: doc.source || '',
      sujet: doc.sujet || '',
      destinataire: doc.destinataire || '',
      description: desc.replace(/تاريخ الرسالة:\s*\S+\s*\|?\s*/, '').trim(),
      etat: doc.etat || 'Nouveau',
      lienPdf: doc.lienPdf || '',
      idService: doc.idService || serviceId,
      estTransmissible: Boolean(doc.estTransmissible),
      numeroDeCourrier: doc.numeroDeCourrier || '',
      tribunalSource: doc.tribunalSource || '',
      typeJudiciaire: doc.typeJudiciaire || '',
      numeroPremiereInstance: doc.numeroPremiereInstance || '',
      destinataireSortant: doc.destinataire || '',
      estDocumentLie: doc.estDocumentLie || false,
      parentJudiciaireId: doc.parentJudiciaireId || '',
      dateMessage: dateMessage,
      dateArrivee: doc.date ? doc.date.slice(0, 10) : '',
      numeroDossier: doc.numeroDossier || ''
    });
    window.scrollTo({ top: 0 });
  };

  const handleDelete = async (id, typeDoc) => {
    if (!perms.canDelete) return;
    if (!window.confirm(t('confirmation_supprimer'))) return;
    try {
      if (typeDoc === 'Judiciaire') await axios.delete(`/api/acteursjudiciaires/${id}`);
      else await axios.delete(`/api/courriers/${id}`);
      showSuccess(t('suppression_succes'));
      fetchData();
    } catch (err) { showError(getErrorMessage(err, t('erreur_suppression'))); }
  };

  // ---------- TRANSFER FUNCTIONS (corrected) ----------
  const openTransferModal = (doc) => {
    console.log('openTransferModal called with doc:', doc);
    setTransferTarget(doc);
    setTransferSelections([]);
    setTransferCurrentService('');
    setTransferCurrentUserIds([]);
    setTransferMessage('');
    setTransferDoitRevenir(false);
    setShowTransferModal(true);
  };

  const openSingleTransferModal = (doc, isJudicial) => {
    console.log('openSingleTransferModal called with doc:', doc, 'isJudicial:', isJudicial);
    setSingleTransferTarget(doc);
    setSingleTransferDocType(isJudicial ? 'Judiciaire' : 'Administratif');
    setSingleTransferServiceId('');
    setSingleTransferUsers([]);
    setSingleTransferUserId('');
    setSingleTransferDoitRevenir(false);
    setSingleTransferMessage('');
    setShowSingleTransferModal(true);
  };

  const handleSingleServiceChange = async (svcId) => {
    setSingleTransferServiceId(svcId);
    setSingleTransferUsers([]);
    setSingleTransferUserId('');
    if (!svcId) return;
    try {
      const res = await axios.get(`/api/utilisateurs?serviceId=${svcId}`);
      setSingleTransferUsers(res.data);
    } catch (err) {
      showError(t('erreur_chargement'));
    }
  };

  const handleSingleTransfer = async () => {
    if (!singleTransferTarget || !singleTransferUserId) {
      showError(t('selection_requise'));
      return;
    }
    const payload = {
      documentId: singleTransferTarget.id,
      documentType: singleTransferDocType,
      destinationServiceId: null,
      destinationUserId: Number(singleTransferUserId),
      doitRevenir: singleTransferDoitRevenir,
      message: singleTransferMessage
    };
    console.log('Single-transfer payload:', payload);
    try {
      await axios.post('/api/transactions', payload);
      showSuccess(t('transaction_envoyee'));
      setShowSingleTransferModal(false);
      fetchData();
    } catch (err) {
      console.error('Single-transfer error:', err);
      let errorMsg = t('erreur_transaction');
      if (err.response?.data) {
        if (typeof err.response.data === 'string') errorMsg = err.response.data;
        else if (err.response.data.message) errorMsg = err.response.data.message;
        else if (err.response.data.title) errorMsg = err.response.data.title;
      }
      alert(errorMsg);
      showError(errorMsg);
    }
  };

  const openTransferChoice = (doc) => {
    console.log('openTransferChoice called with doc:', doc);
    setTransferChoiceDoc(doc);
    setShowTransferChoice(true);
  };

  const handleTransferChoice = (mode) => {
    console.log('handleTransferChoice called with mode:', mode);
    setShowTransferChoice(false);
    if (mode === 'single') openSingleTransferModal(transferChoiceDoc, false); // administrative choice
    else openTransferModal(transferChoiceDoc);
  };

  const handleTransferServiceChange = async (svcId) => {
    setTransferCurrentService(svcId);
    setTransferCurrentUserIds([]);
  };
  const toggleCurrentUser = (userId) => {
    setTransferCurrentUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };
  const addCurrentSelection = () => {
    if (!transferCurrentService || transferCurrentUserIds.length === 0) return;
    setTransferSelections(prev => {
      const existing = prev.find(s => s.serviceId === transferCurrentService);
      if (existing) {
        return prev.map(s => s.serviceId === transferCurrentService
          ? { ...s, userIds: [...new Set([...s.userIds, ...transferCurrentUserIds])] }
          : s);
      }
      return [...prev, { serviceId: transferCurrentService, userIds: [...transferCurrentUserIds] }];
    });
    setTransferCurrentService('');
    setTransferCurrentUserIds([]);
  };
  const removeSelection = (serviceId) => {
    setTransferSelections(prev => prev.filter(s => s.serviceId !== serviceId));
  };
  const handleMultiTransfer = async () => {
    const allUserIds = transferSelections.flatMap(s => s.userIds);
    if (!transferTarget || allUserIds.length === 0) {
      showError(t('selection_requise'));
      return;
    }
    try {
      for (let userId of allUserIds) {
        await axios.post('/api/transactions', {
          documentId: transferTarget.id,
          documentType: transferTarget.typeDocument || 'Administratif',
          destinationServiceId: null,
          destinationUserId: userId,
          doitRevenir: transferDoitRevenir,
          message: transferMessage
        });
      }
      showSuccess(t('transaction_envoyee'));
      setShowTransferModal(false);
      fetchData();
    } catch (err) {
      console.error('Multi-transfer error:', err);
      showError(err.response?.data?.message || t('erreur_transaction'));
    }
  };

  // ---------- REPLY ----------
  const openReplyModal = (doc) => {
    setReplyTarget(doc);
    setReplyForm({ destinataire: '', sujet: '', date: new Date().toISOString().slice(0, 10), lienPdf: '', description: '' });
    setShowReplyModal(true);
  };
  const submitReply = async () => {
    const { destinataire, sujet, date, lienPdf, description } = replyForm;
    if (!sujet.trim()) return;
    try {
      await axios.post('/api/courriers', {
        idBureauOrdre: '', date: new Date(date).toISOString(), source: 'Réponse',
        sujet: sujet.trim(), destinataire: destinataire.trim(), description: description.trim(),
        etat: 'Nouveau', lienPdf: lienPdf.trim(), direction: 'Sortant',
        typeRegistre: 'Morasalat', typeCorrespondance: 'Sortante',
        parentId: replyTarget.id, idService: serviceId, numeroDeCourrier: '', estTransmissible: false,
      });
      showSuccess(t('reply_added'));
      setShowReplyModal(false);
      setRepliedIds(prev => new Set(prev).add(Number(replyTarget.id)));
      fetchData();
    } catch (err) { showError(getErrorMessage(err, t('erreur_enregistrement'))); }
  };
  const handleReplyUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    setUploadingReply(true);
    try { const res = await axios.post('/api/courriers/upload-document', fd); setReplyForm(prev => ({ ...prev, lienPdf: res.data.lienPdf })); }
    catch (err) { showError(getErrorMessage(err, t('erreur_upload'))); }
    finally { setUploadingReply(false); e.target.value = ''; }
  };

  // ---------- ANSWER ----------
  const openAnswerModal = (doc) => {
    setAnswerTarget(doc);
    setAnswerForm({ source: '', sujet: 'RE: ' + doc.sujet, date: new Date().toISOString().slice(0, 10), lienPdf: '', description: '', estTransmissible: false });
    setShowAnswerModal(true);
  };
  const submitAnswer = async () => {
    const { source, sujet, date, lienPdf, description, estTransmissible } = answerForm;
    if (!description.trim()) { showError(t('reponse_requise') || 'La réponse est obligatoire.'); return; }
    try {
      await axios.post('/api/courriers', {
        idBureauOrdre: answerTarget.idBureauOrdre || '', date: new Date(date).toISOString(),
        source: source.trim() || 'Réponse', sujet: sujet.trim() || 'RE: ' + answerTarget.sujet,
        destinataire: 'محكمة الاستئناف', description: description.trim(), etat: 'Nouveau',
        lienPdf: lienPdf.trim(), direction: 'Entrant', typeRegistre: 'Waridat',
        typeCorrespondance: null, parentId: answerTarget.id, idService: serviceId,
        numeroDeCourrier: '', estTransmissible: Boolean(estTransmissible),
      });
      showSuccess(t('reply_added'));
      setShowAnswerModal(false);
      setRepliedIds(prev => new Set(prev).add(Number(answerTarget.id)));
      fetchData();
    } catch (err) { showError(getErrorMessage(err, t('erreur_enregistrement'))); }
  };
  const handleAnswerUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    setUploadingAnswer(true);
    try { const res = await axios.post('/api/courriers/upload-document', fd); setAnswerForm(prev => ({ ...prev, lienPdf: res.data.lienPdf })); }
    catch (err) { showError(getErrorMessage(err, t('erreur_upload'))); }
    finally { setUploadingAnswer(false); e.target.value = ''; }
  };

  // ---------- VIEW REPLY ----------
  const handleViewReply = (doc) => {
    const child = allDocs.find(d => Number(d.parentId) === Number(doc.id));
    if (child) { setViewedReply(child); setEditingReply(false); setShowViewReplyModal(true); }
    else { alert(t('no_reply')); }
  };
  const startEditingReply = () => {
    setEditReplyForm({ source: viewedReply.source || '', sujet: viewedReply.sujet || '', date: viewedReply.date ? viewedReply.date.slice(0, 10) : '', description: viewedReply.description || '', lienPdf: viewedReply.lienPdf || '', destinataire: viewedReply.destinataire || '' });
    setEditingReply(true);
  };
  const cancelEditingReply = () => setEditingReply(false);
  const saveEditedReply = async () => {
    try {
      const typeDoc = viewedReply.typeDocument || 'Administratif';
      if (typeDoc === 'Judiciaire') {
        await axios.put(`/api/acteursjudiciaires/${viewedReply.id}`, { idBureauOrdre: viewedReply.idBureauOrdre, date: new Date(editReplyForm.date).toISOString(), tribunalSource: editReplyForm.source, sujet: editReplyForm.sujet, direction: 'Entrant', description: editReplyForm.description, etatArchive: viewedReply.etatArchive || 'Nouveau', lienPdf: editReplyForm.lienPdf, idService: viewedReply.idService, estTransmissible: viewedReply.estTransmissible, numeroPremiereInstance: viewedReply.numeroPremiereInstance, destinataire: editReplyForm.destinataire });
      } else {
        await axios.put(`/api/courriers/${viewedReply.id}`, { idBureauOrdre: viewedReply.idBureauOrdre || '', date: new Date(editReplyForm.date).toISOString(), source: editReplyForm.source, sujet: editReplyForm.sujet, destinataire: editReplyForm.destinataire, description: editReplyForm.description, etat: 'Nouveau', lienPdf: editReplyForm.lienPdf, direction: viewedReply.direction, typeRegistre: viewedReply.typeRegistre, typeCorrespondance: viewedReply.typeCorrespondance, parentId: viewedReply.parentId, idService: viewedReply.idService, numeroDeCourrier: '', estTransmissible: viewedReply.estTransmissible });
      }
      showSuccess(t('modification_succes'));
      setShowViewReplyModal(false);
      fetchData();
    } catch (err) { showError(getErrorMessage(err, t('erreur_enregistrement'))); }
  };
  const openTransferFromView = () => {
    if (!viewedReply) return;
    setShowViewReplyModal(false);
    if (viewedReply.typeDocument === 'Judiciaire') openSingleTransferModal(viewedReply, true);
    else openTransferChoice(viewedReply);
  };

  // ---------- HISTORY ----------
  const handleViewHistory = async (doc) => {
    setHistoryDocumentTitle(doc.sujet || doc.idBureauOrdre || 'Document');
    try {
      const docType = doc.typeDocument === 'Judiciaire' ? 'Judiciaire' : 'Administratif';
      const res = await axios.get(`/api/transactions/history/${doc.id}?type=${docType}`);
      setHistoryTransactions(res.data.filter(tx => tx.statut === 'Accepté'));
      setShowHistoryModal(true);
    } catch (err) { showError(getErrorMessage(err, t('erreur_chargement_historique'))); }
  };

  const handleViewWithdrawals = async (doc) => {
    setWithdrawDocumentTitle(doc.sujet || doc.idBureauOrdre || 'Document');
    try {
      const res = await axios.get(`/api/acteursjudiciaires/${doc.id}/retraits`);
      setWithdrawals(res.data);
      setShowWithdrawModal(true);
    } catch (err) { showError(getErrorMessage(err, t('erreur_chargement'))); }
  };

  const handleViewDocument = async (doc) => {
    try {
      if (doc.typeDocument !== 'Judiciaire') {
        const res = await axios.get(`/api/courriers/${doc.id}`);
        setCurrentDocument(res.data);
      } else {
        const res = await axios.get(`/api/acteursjudiciaires/${doc.id}`);
        setCurrentDocument(res.data);
      }
      setShowDocModal(true);
    } catch (err) { showError(getErrorMessage(err, t('impossible_charger'))); }
  };

  const handleMainUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  setUploading(true);
  setPdfMessage({ text: '', type: '' }); // clear previous message
  try {
    const url = tab === TYPE_JUDICIAIRE ? '/api/acteursjudiciaires/upload-pdf' : '/api/courriers/upload-document';
    const res = await axios.post(url, fd);
    setForm(prev => ({ ...prev, lienPdf: res.data.lienPdf }));
    setPdfMessage({ text: t('document_uploaded'), type: 'success' });
    setTimeout(() => setPdfMessage({ text: '', type: '' }), 3000);
  } catch (err) {
    setPdfMessage({ text: getErrorMessage(err, t('erreur_upload')), type: 'error' });
    setTimeout(() => setPdfMessage({ text: '', type: '' }), 4000);
  } finally {
    setUploading(false);
    e.target.value = '';
  }
};

  const exportToExcel = () => {
    let url = '/api/courriers/export/excel';
    const params = new URLSearchParams();
    if (selectedRowIds.length > 0) {
      selectedRowIds.forEach(id => params.append('ids', id));
    } else {
      if (search) params.append('motCle', search);
    }
    const queryString = params.toString();
    if (queryString) url += '?' + queryString;
    fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(res => res.blob())
      .then(blob => {
        const urlBlob = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlBlob;
        a.download = `courriers_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(urlBlob);
      })
      .catch(() => showError(t('erreur_export')));
  };

  // ========== IMPORT FUNCTIONS ==========
  const openImportModal = () => {
    setShowImportTypeModal(true);
    setSelectedImportType('');
    setImportFile(null);
    setHeaders([]);
    setMapping({});
  };

  const downloadTemplateForType = async (type) => {
    const typeObj = importTypes.find(t => t.value === type);
    if (!typeObj) return;
    try {
      const res = await axios.get(typeObj.template, { responseType: 'blob', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template_${type}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showError(t('erreur_telechargement_modele') || 'Erreur lors du téléchargement du modèle');
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post('/api/courriers/import/preview', formData, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setHeaders(res.data);
      const initialMapping = {};
      requiredColumnsMap[selectedImportType]?.forEach(col => { initialMapping[col] = ''; });
      setMapping(initialMapping);
      setShowImportTypeModal(false);
      setShowMappingModal(true);
    } catch (err) {
      showError(t('erreur_lecture_fichier') || 'Erreur lors de la lecture du fichier');
      setImportFile(null);
    }
    e.target.value = '';
  };

  const executeImport = async () => {
    if (!importFile || !selectedImportType) return;
    const requiredCols = requiredColumnsMap[selectedImportType] || [];
    const missingMappings = requiredCols.filter(col => !mapping[col]);
    if (missingMappings.length > 0) {
      showError(t('colonnes_requises_manquantes') || 'Veuillez mapper toutes les colonnes requises');
      return;
    }
    const formData = new FormData();
    formData.append('file', importFile);
    const params = new URLSearchParams();
    params.append('type', selectedImportType);
    Object.entries(mapping).forEach(([key, value]) => {
      if (value) {
        const paramName = `col${key.charAt(0).toUpperCase() + key.slice(1)}`;
        params.append(paramName, value);
      }
    });
    setImportLoading(true);
    try {
      const res = await axios.post(`/api/courriers/import/execute?${params.toString()}`, formData, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = res.data;
      let message = `✅ ${data.imported} ${t('import_succes', { count: data.imported })}`;
      if (data.errors?.length) message += `\n\n⚠️ ${t('details_erreurs')}:\n${data.errors.join('\n')}`;
      alert(message);
      if (data.imported > 0) fetchData();
      setShowMappingModal(false);
      setImportFile(null);
      setMapping({});
      setSelectedImportType('');
    } catch (err) {
      showError(getErrorMessage(err, t('erreur_import')));
    } finally {
      setImportLoading(false);
    }
  };

  const formatEtat = (code) => {
    const state = documentStates.find(s => s.code === code);
    if (!state) return code;
    return locale === 'ar' ? state.valueAr : state.valueFr;
  };

  const getColumnLabel = (colKey) => {
    const labels = {
      serialNumber: "Numéro de Bureau d'Ordre / رقم مكتب الضبط",
      subject: 'Objet / الموضوع',
      senderName: 'Source / المصدر',
      arrivalDate: "Date d'Arrivée / تاريخ الوصول",
      resultNote: 'Description / الوصف',
      number: 'Numéro Interne / الرقم الداخلي',
      letterDate: 'Date de la Lettre / تاريخ الرسالة',
      tribunalSource: 'Tribunal Source / مصدر المحكمة',
      date: 'Date / التاريخ',
      numeroDossier: 'Numéro de Dossier / رقم الملف',
      numeroPremiereInstance: 'Numéro Première Instance / رقم أول درجة',
      description: 'Description / الوصف',
      parentJudiciaireId: 'ID Dossier Parent / معرف الملف الأصلي',
      destinataire: 'Destinataire / المرسل إليه'
    };
    return labels[colKey] || colKey;
  };

  // ========== RENDER ==========
  return (
    <div className="page-container" dir="rtl">
      <h1 className="page-title">{t('menu_courriers')}</h1>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Tabs */}
      <div className="registry-choice">
        {showAdministratif && <button className={`choice-pill ${tab === TYPE_ADMINISTRATIF ? 'active' : ''}`} onClick={() => switchTab(TYPE_ADMINISTRATIF)}>{t(TYPE_ADMINISTRATIF)}</button>}
        {showJudiciaire && <button className={`choice-pill ${tab === TYPE_JUDICIAIRE ? 'active' : ''}`} onClick={() => switchTab(TYPE_JUDICIAIRE)}>{t(TYPE_JUDICIAIRE)}</button>}
        {showSortant && <button className={`choice-pill ${tab === TYPE_SORTANT ? 'active' : ''}`} onClick={() => switchTab(TYPE_SORTANT)}>{t(TYPE_SORTANT)}</button>}
      </div>

      {/* Form */}
      {((tab === TYPE_ADMINISTRATIF && perms.canCreateAdministratif) ||
        (tab === TYPE_JUDICIAIRE && (perms.canCreateJuridique || perms.canCreateLinked)) ||
        (tab === TYPE_SORTANT && perms.canCreateAdministratif)) && (
        <div className="form-card">
          <h3>{editingId ? t('modifier') : t('ajouter')} – {t(tab)}</h3>
          <form onSubmit={handleSubmit}>
            {tab === TYPE_JUDICIAIRE && (
              <div className="registry-choice sub-choice" style={{ marginBottom: '1.5rem' }}>
                {(!isProcedures) && perms.canCreateJuridique && <button type="button" className={`choice-pill ${judMode === 'file' ? 'active' : ''}`} onClick={() => { setJudMode('file'); setForm(emptyForm(TYPE_JUDICIAIRE)); }}>ملف</button>}
                {perms.canCreateLinked && <button type="button" className={`choice-pill ${judMode === 'linked' ? 'active' : ''}`} onClick={() => { setJudMode('linked'); setForm(emptyForm(TYPE_JUDICIAIRE)); fetchParentFiles(); }}>وثيقة مربوطة بملف</button>}
              </div>
            )}
            <div className="form-grid">
              {(tab === TYPE_JUDICIAIRE || tab === TYPE_ADMINISTRATIF || tab === TYPE_SORTANT) && (isAdmin || isGreffier) && (
                <div className="form-field">
                  <label>{t('numero_bureau_ordre')} {isGreffier ? '*' : ''}</label>
                  <input type="number" name="idBureauOrdre" value={form.idBureauOrdre} onChange={handleChange} required={isGreffier} placeholder="15" />
                  <small>{currentYear} / {t('auto_year_suffix') || ''}</small>
                </div>
              )}
              {tab === TYPE_JUDICIAIRE && userRole !== 'Greffier' && judMode !== 'linked' && perms.canCreateJuridique && (
                <div className="form-field">
                  <label>{t('numero_dossier_judiciaire') || 'رقم الاستئنافي'}</label>
                  <input type="text" name="numeroDossier" value={form.numeroDossier} onChange={handleChange} placeholder="2026/15/3" />
                </div>
              )}
              {tab === TYPE_ADMINISTRATIF && <div className="form-field"><label>{t('numero_interne')}</label><input type="text" name="numeroDeCourrier" value={form.numeroDeCourrier} onChange={handleChange} /></div>}

              {tab === TYPE_ADMINISTRATIF && (
                <>
                  <div className="form-field"><label>{t('date_message') || 'تاريخ الرسالة'}</label><input type="date" name="dateMessage" value={form.dateMessage} onChange={handleChange} /></div>
                  <div className="form-field"><label>{t('date_arrivee') || 'تاريخ الوصول'} *</label><input type="date" name="dateArrivee" value={form.dateArrivee} onChange={handleChange} required /></div>
                </>
              )}
              {tab === TYPE_SORTANT && <div className="form-field"><label>{t('date')} *</label><input type="date" name="date" value={form.date} onChange={handleChange} required /></div>}
              {tab === TYPE_JUDICIAIRE && <div className="form-field"><label>{t('date')} *</label><input type="date" name="date" value={form.date} onChange={handleChange} required /></div>}

              {tab === TYPE_JUDICIAIRE ? (
                <div className="form-field">
                  <label>{t('tribunal_source')} *</label>
                  <select name="tribunalSource" value={form.tribunalSource} onChange={handleChange} required={judMode !== 'linked'}>
                    <option value="">-- {t('choisir')} --</option>
                    {tribunalTypes.map(tt => (<option key={tt.code} value={tt.code}>{locale === 'ar' ? tt.valueAr : tt.valueFr}</option>))}
                  </select>
                </div>
              ) : tab !== TYPE_SORTANT && (
              <div className="form-field">
                <label>{t('source')} *</label>
                <select name="source" value={form.source} onChange={handleChange} required>
                  <option value="">-- {t('choisir')} --</option>
                  {sourceOptions.map(opt => (
                    <option key={opt.code} value={opt.code}>
                      {locale === 'ar' ? opt.valueAr : opt.valueFr}
                    </option>
                  ))}
                </select>
              </div>
              )}

              {tab === TYPE_JUDICIAIRE && judMode === 'linked' && (
                <div className="form-field">
                  <label>{t('choisir_dossier_parent')}</label>
                  <select name="parentJudiciaireId" value={form.parentJudiciaireId} onChange={handleChange} required>
                    <option value="">-- {t('choisir')} --</option>
                    {parentFiles.map(p => (<option key={p.id} value={p.id}>{p.numeroDossier}</option>))}
                  </select>
                </div>
              )}

              <div className="form-field"><label>{t('objet')} *</label><input type="text" name="sujet" value={form.sujet} onChange={handleChange} required /></div>
              {tab === TYPE_SORTANT && <div className="form-field"><label>{t('destinataire')}</label><input type="text" name="destinataireSortant" value={form.destinataireSortant} onChange={handleChange} /></div>}
              {tab === TYPE_JUDICIAIRE && judMode !== 'linked' && (
                <>
                  <div className="form-field"><label>{t('numero_premiere_instance') || 'الرقم الابتدائي'}</label><input name="numeroPremiereInstance" value={form.numeroPremiereInstance} onChange={handleChange} placeholder="2026/12" /></div>
                  <div className="form-field">
                    <label>{t('type_judiciaire') || 'النوع'}</label>
                    <select name="typeJudiciaire" value={form.typeJudiciaire} onChange={handleChange}>
                      <option value="">-- {t('choisir')} --</option>
                      {judicialTypes.map(jt => (<option key={jt.code} value={jt.code}>{locale === 'ar' ? jt.valueAr : jt.valueFr}</option>))}
                    </select>
                  </div>
                </>
              )}
              <div className="form-field"><label>{t('service')} *</label><input type="text" value={services.find(s => s.idService === form.idService)?.nomService || ''} disabled /><input type="hidden" name="idService" value={form.idService} /></div>
              {tab !== TYPE_SORTANT && (
                <div className="form-field">
                  <label>{t('etat')}</label>
                  <select name="etat" value={form.etat} onChange={handleChange}>
                    {documentStates.map(state => (<option key={state.code} value={state.code}>{locale === 'ar' ? state.valueAr : state.valueFr}</option>))}
                  </select>
                </div>
              )}
              {tab === TYPE_ADMINISTRATIF && (
                <div className="form-field">
                  <label>{t('transmissible')}</label>
                  <label className="checkbox-field"><input type="checkbox" name="estTransmissible" checked={form.estTransmissible} onChange={handleChange} /> {t('oui')}</label>
                </div>
              )}
                <div className="form-field full-width"><label>{t('document_pdf_word')}</label><div className="document-control">
                    <label className="document-upload-button">
                      {uploading ? t('uploading') : t('choisir_fichier')}
                      <input type="file" accept=".pdf,.doc,.docx" onChange={handleMainUpload} />
                    </label>
                    <div className={form.lienPdf ? "document-link-preview filled" : "document-link-preview"}>
                      <span title={form.lienPdf}>{form.lienPdf ? getDocumentName(form.lienPdf) : t('aucun_fichier')}</span>
                      {form.lienPdf && <a href={getDocumentHref(form.lienPdf)} target="_blank" rel="noreferrer">{t('ouvrir')}</a>}
                    </div>
         
                  </div>
                  {/* PDF upload message right below the controls */}
                  {pdfMessage.text && (
                    <div className={pdfMessage.type === 'success' ? 'success-message' : 'error-message'} style={{ marginTop: '0.5rem', fontSize: '0.85rem', textAlign: 'center' }}>
                      {pdfMessage.text}
                    </div>
                  )}
                </div>             
             
              <div className="form-field full-width"><label>{t('notes')}</label><textarea name="description" value={form.description} onChange={handleChange} rows="3" /></div>
            </div>
            <div className="form-actions"><button type="submit" className="btn-primary">{editingId ? t('modifier') : t('ajouter')}</button>{editingId && <button type="button" className="btn-secondary" onClick={resetForm}>{t('annuler')}</button>}</div>
          </form>
        </div>
      )}

      {/* Table Controls */}
      <div className="data-table-wrapper" style={{ marginTop: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, whiteSpace: 'nowrap' }}>{t('registre')} ({filtered.length})</h3>
            <button className="btn-secondary" onClick={() => setShowColumnMenu(!showColumnMenu)}>📋 {t('colonnes')}</button>
            <input type="text" placeholder={t('rechercher_par_mot')} value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: '180px', maxWidth: '300px', padding: '0.4rem 0.75rem' }} />
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#f8f9fc', padding: '0.2rem 0.6rem', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <span>{t('afficher')}</span>
              <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }} style={{ minHeight: '32px', padding: '0.2rem 0.4rem', borderRadius: '16px', border: '1px solid #cbd5e1', background: 'white' }}>
                <option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option>
              </select>
              <span>{t('lignes')}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={exportToExcel}>📊 {t('exporter_excel')}</button>
            <button className="btn-primary" onClick={openImportModal}>📥 {t('importer_excel')}</button>
          </div>
        </div>

        {showColumnMenu && (
          <div className="modal-overlay" onClick={() => setShowColumnMenu(false)}>
            <div className="modal" style={{ maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div className="registry-panel-header"><h3>{t('customiser_colonnes')}</h3><button className="btn-secondary" onClick={() => setShowColumnMenu(false)}>{t('fermer')}</button></div>
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {Object.entries(visibleColumns).map(([col, isVisible]) => (
                  <div key={col} className="form-field">
                    <label className="checkbox-field"><input type="checkbox" checked={isVisible} onChange={() => toggleColumn(col)} /> {t(`col_${col}`)}</label>
                  </div>
                ))}
              </div>
              <div className="form-actions">
                <button className="btn-secondary" onClick={() => setVisibleColumns(Object.keys(visibleColumns).reduce((acc, k) => ({ ...acc, [k]: true }), {}))}>{t('tout_selectionner')}</button>
                <button className="btn-secondary" onClick={() => setVisibleColumns(Object.keys(visibleColumns).reduce((acc, k) => ({ ...acc, [k]: false }), {}))}>{t('tout_deselectionner')}</button>
                <button className="btn-primary" onClick={() => setShowColumnMenu(false)}>{t('appliquer')}</button>
                {selectedRowIds.length > 0 && <button className="btn-secondary" onClick={() => { setSelectedRowIds([]); setSelectAll(false); }}>{t('clear_selection')}</button>}
              </div>
            </div>
          </div>
        )}

        {loading ? <div className="loading">{t('chargement')}</div> : (
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}><input type="checkbox" checked={selectAll} onChange={handleSelectAll} /></th>
                {visibleColumns.idBureauOrdre && <th>{t('col_idBureauOrdre')}</th>}
                {visibleColumns.dateMessage && <th>{t('col_dateMessage')}</th>}
                {visibleColumns.numeroCourrier && <th>{t('col_numeroCourrier')}</th>}
                {visibleColumns.dateArrival && <th>{t('col_dateArrival')}</th>}
                {visibleColumns.subject && <th>{t('col_subject')}</th>}
                {visibleColumns.type && <th>{t('col_type')}</th>}
                {visibleColumns.source && <th>{t('col_source')}</th>}
                {visibleColumns.destinataire && <th>{t('col_destinataire')}</th>}
                {visibleColumns.etat && <th>{t('col_etat')}</th>}
                {visibleColumns.emplacement && <th>{t('col_emplacement')}</th>}
                {visibleColumns.pdf && <th>PDF</th>}
                {visibleColumns.replyInfo && <th>{t('col_replyInfo') || 'الرد'}</th>}
                {visibleColumns.actions && <th>{t('actions')}</th>}
            
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr><td colSpan={Object.values(visibleColumns).filter(v => v).length + 1} style={{ textAlign: 'center' }}>{t('aucun_enregistrement')}</td></tr>
              ) : (
                currentItems.map(doc => {
                  const isJud = doc.typeDocument === 'Judiciaire';
                  const isSort = doc.typeRegistre === 'Morasalat' && doc.typeCorrespondance === 'Sortante';
                  const isReply = !!doc.parentId;
                  const canEdit = perms.canCreateAdministratif || perms.canCreateJuridique || perms.canCreateLinked;
                  const showReplyBtn = repliedIds.has(Number(doc.id));
                  const desc = doc.description || '';
                  const match = desc.match(/تاريخ الرسالة:\s*(\S+)/);
                  const dateMessage = match ? match[1] : '';
                  const isInMyService = Number(doc.idService) === Number(serviceId);
                  const isTransmissible = isJud ? true : (isSort ? false : doc.estTransmissible !== false);
                  const canTransfer = !doc.estArchive && isTransmissible && isInMyService && (isJud ? true : !doc.hasTransaction) && perms.canTransfer;
                  const docTypeLabel = isJud ? t('judiciaire') : (isSort ? t('sortante') : t('administratif'));
                  const docTypeClass = isJud ? 'judiciaire' : (isSort ? 'sortante' : 'administratif');

                  const reply = allDocs.find(d => d.parentId === doc.id);
                  return (
                    <tr key={`${doc.id}_${doc.typeDocument}`}>
                      <td style={{ width: '40px' }}><input type="checkbox" checked={selectedRowIds.includes(doc.id)} onChange={() => handleSelectRow(doc.id)} /></td>
                      {visibleColumns.idBureauOrdre && <td>{doc.idBureauOrdre || '-'}</td>}
                      {visibleColumns.dateMessage && <td>{dateMessage ? formatDate(dateMessage) : '-'}</td>}
                      {visibleColumns.numeroCourrier && <td>{doc.numeroDeCourrier || '-'}</td>}
                      {visibleColumns.dateArrival && <td>{formatDate(doc.date)}</td>}
                      {visibleColumns.subject && <td>{doc.sujet || '-'}</td>}
                      {visibleColumns.type && <td><span className={`type-badge ${docTypeClass}`}>{docTypeLabel}</span></td>}
                      {visibleColumns.source && <td>{doc.source || doc.tribunalSource || '-'}</td>}
                      {visibleColumns.destinataire && <td>{doc.destinataire || '-'}</td>}
                      {visibleColumns.etat && <td>{formatEtat(doc.etat || doc.etatArchive)}</td>}
                      {visibleColumns.emplacement && <td>{doc.emplacement || '-'}</td>}
                      {visibleColumns.pdf && <td>{doc.lienPdf ? <a href={getDocumentHref(doc.lienPdf)} target="_blank" rel="noreferrer">PDF</a> : '-'}</td>}                    
                      {visibleColumns.replyInfo && (
                        <td className="reply-cell-wide">
                          {reply ? (
                            <div className="reply-card">
                              <div className="reply-card-header">
                                <span className="reply-icon">💬</span>
                                <span className="reply-date-large">{formatDate(reply.date)}</span>
                              </div>
                              <div className="reply-card-subject">{reply.sujet || '-'}</div>
                              <div className="reply-card-meta">
                                <span className="meta-label">{t('col_replySource') || 'مصدر / مرسل إليه'}:</span>
                                <span className="meta-value">{reply.source || reply.destinataire || '-'}</span>
                              </div>
                              {reply.description && (
                                <div className="reply-card-description">
                                  <span className="meta-label">{t('الرد') || 'الرد'}:</span>
                                  <span className="meta-value">{reply.description.length > 120 ? reply.description.slice(0, 120) + '…' : reply.description}</span>
                                </div>
                              )}
                              {reply.lienPdf && (
                                <div className="reply-card-pdf">
                                  <a href={getDocumentHref(reply.lienPdf)} target="_blank" rel="noreferrer" className="btn-secondary btn-small" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                                    📎 {t('ouvrir')}
                                  </a>
                                </div>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                      )}                     
                      {visibleColumns.actions && (
                        <td className="action-icons">
                          <button className="action-btn" onClick={() => handleViewDocument(doc)} title={t('consulter')}>📄 {t('consulter')}</button>
                          {canEdit && <button className="action-btn" onClick={() => handleEdit(doc)} title={t('modifier')}>✏️ {t('modifier')}</button>}
                          {isAdmin && <button className="action-btn action-btn-danger" onClick={() => handleDelete(doc.id, doc.typeDocument)} title={t('supprimer')}>🗑️ {t('supprimer')}</button>}
                          {canTransfer && (isJud ? (
                            <button className="action-btn action-btn-success" onClick={() => openSingleTransferModal(doc, true)} title={t('transferer')}>↗️ {t('transferer')}</button>
                          ) : (
                            <button className="action-btn action-btn-success" onClick={() => openTransferChoice(doc)} title={t('transferer')}>↗️ {t('transferer')}</button>
                          ))}
                          {!isSort && !isReply && !showReplyBtn && <button className="action-btn" onClick={() => openReplyModal(doc)} title={t('repondre')}>↩️ {t('repondre')}</button>}
                          {isSort && !isReply && !showReplyBtn && <button className="action-btn" onClick={() => openAnswerModal(doc)} title={t('ajouter_reponse')}>📝 {t('ajouter_reponse')}</button>}
                          {showReplyBtn && <button className="action-btn" onClick={() => handleViewReply(doc)} title={t('voir_reponse')}>👁️ {t('voir_reponse')}</button>}
                          <button className="action-btn" onClick={() => handleViewHistory(doc)} title={t('historique_transactions')}>📜 {t('historique_transactions')}</button>
                          {isJud && <button className="action-btn" onClick={() => handleViewWithdrawals(doc)} title={t('retraits')}>📤 {t('retraits')}</button>}
                        
                         
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>{t('precedent')}</button>
            <span>{t('page')} {page} / {totalPages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>{t('suivant')}</button>
          </div>
        )}
      </div>

      {/* Hidden file input for import */}
      <input type="file" ref={importFileInputRef} accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileSelect} />

      {/* IMPORT TYPE SELECTION MODAL */}
      {showImportTypeModal && (
        <div className="modal-overlay" onClick={() => setShowImportTypeModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>📥 {t('choisir_type_import') || 'اختر نوع الاستيراد'}</h3>
              <button className="btn-secondary" onClick={() => setShowImportTypeModal(false)}>{t('fermer')}</button>
            </div>
            <div style={{ padding: '1rem' }}>
              <p style={{ marginBottom: '1.5rem', color: '#666', textAlign: 'center' }}>{t('import_instructions') || 'اختر نوع البيانات التي تريد استيرادها'}</p>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                {importTypes.map(type => (
                  <div key={type.value} style={{ border: '2px solid #e2e8f0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', background: '#f8f9fc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '2rem' }}>{type.icon}</span>
                      <h4 style={{ margin: 0, flex: 1 }}>{type.label}</h4>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-primary" style={{ flex: 1 }} onClick={() => { setSelectedImportType(type.value); setTimeout(() => importFileInputRef.current?.click(), 0); }}>
                        ✅ {t('choisir_fichier') || 'اختر ملف'}
                      </button>
                      <button className="btn-secondary" onClick={() => downloadTemplateForType(type.value)} title={t('telecharger_modele')}>📄 {t('modele') || 'النموذج'}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COLUMN MAPPING MODAL */}
      {showMappingModal && (
        <div className="modal-overlay" onClick={() => setShowMappingModal(false)}>
          <div className="modal" style={{ maxWidth: '700px', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>🔗 {t('associer_colonnes') || 'ربط الأعمدة'}</h3>
              <button className="btn-secondary" onClick={() => setShowMappingModal(false)}>{t('fermer')}</button>
            </div>
            <div style={{ padding: '1rem' }}>
              <div style={{ background: '#e0f2fe', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #0284c7' }}>
                <p style={{ margin: 0, color: '#0c4a6e' }}>ℹ️ {t('mapping_instructions') || 'قم بربط أعمدة ملف Excel الخاص بك مع الحقول المطلوبة'}</p>
              </div>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                {requiredColumnsMap[selectedImportType]?.map(col => (
                  <div key={col} className="form-field">
                    <label style={{ fontWeight: 'bold', color: '#1e40af' }}>{getColumnLabel(col)} <span style={{ color: 'red' }}>*</span></label>
                    <select value={mapping[col] || ''} onChange={e => setMapping({ ...mapping, [col]: e.target.value })} style={{ padding: '0.5rem', borderRadius: '6px', border: mapping[col] ? '2px solid #10b981' : '2px solid #ef4444' }}>
                      <option value="">-- {t('choisir_colonne') || 'اختر العمود'} --</option>
                      {headers.map(h => (<option key={h} value={h}>{h}</option>))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-primary" onClick={executeImport} disabled={importLoading || requiredColumnsMap[selectedImportType]?.some(col => !mapping[col])} style={{ fontSize: '1rem', padding: '0.75rem 1.5rem' }}>
                {importLoading ? <>⏳ {t('importing')}</> : <>✅ {t('importer')}</>}
              </button>
              <button className="btn-secondary" onClick={() => setShowMappingModal(false)}>❌ {t('annuler')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ========== ALL OTHER MODALS (reply, answer, transfer, etc.) ========== */}
      {/* Reply Modal */}
      {showReplyModal && (
        <div className="modal-overlay" onClick={() => setShowReplyModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header"><h3>{t('repondre')}</h3><button className="btn-secondary" onClick={() => setShowReplyModal(false)}>{t('fermer')}</button></div>
            <div className="form-grid">
              <div className="form-field"><label>{t('destinataire')}</label><input value={replyForm.destinataire} onChange={e => setReplyForm({ ...replyForm, destinataire: e.target.value })} /></div>
              <div className="form-field"><label>{t('sujet')} *</label><input value={replyForm.sujet} onChange={e => setReplyForm({ ...replyForm, sujet: e.target.value })} required /></div>
              <div className="form-field"><label>{t('date')}</label><input type="date" value={replyForm.date} onChange={e => setReplyForm({ ...replyForm, date: e.target.value })} /></div>
              <div className="form-field full-width"><label>{t('document_pdf_word')}</label><div className="document-control"><label className="document-upload-button">{uploadingReply ? t('uploading') : t('choisir_fichier')}<input type="file" accept=".pdf,.doc,.docx" onChange={handleReplyUpload} /></label><div className={replyForm.lienPdf ? "document-link-preview filled" : "document-link-preview"}><span>{replyForm.lienPdf ? getDocumentName(replyForm.lienPdf) : t('aucun_fichier')}</span>{replyForm.lienPdf && <a href={getDocumentHref(replyForm.lienPdf)} target="_blank" rel="noreferrer">{t('ouvrir')}</a>}</div><div className="document-link-input"><input type="text" value={replyForm.lienPdf} onChange={e => setReplyForm({ ...replyForm, lienPdf: e.target.value })} placeholder={t('lien_manuel')} />{replyForm.lienPdf && <a href={getDocumentHref(replyForm.lienPdf)} target="_blank" rel="noreferrer">{t('ouvrir')}</a>}</div></div></div>
              <div className="form-field full-width"><label>{t('الرد')}</label><textarea value={replyForm.description} onChange={e => setReplyForm({ ...replyForm, description: e.target.value })} rows="3" /></div>
            </div>
            <div className="form-actions"><button className="btn-primary" onClick={submitReply}>{t('envoyer')}</button><button className="btn-secondary" onClick={() => setShowReplyModal(false)}>{t('annuler')}</button></div>
          </div>
        </div>
      )}

      {/* Answer Modal */}
      {showAnswerModal && (
        <div className="modal-overlay" onClick={() => setShowAnswerModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header"><h3>{t('ajouter_reponse')}</h3><button className="btn-secondary" onClick={() => setShowAnswerModal(false)}>{t('fermer')}</button></div>
            {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}
            <div className="form-grid">
              <div className="form-field"><label>{t('source')}</label><input value={answerForm.source} onChange={e => setAnswerForm({ ...answerForm, source: e.target.value })} /></div>
              <div className="form-field"><label>{t('sujet')}</label><input value={answerForm.sujet} onChange={e => setAnswerForm({ ...answerForm, sujet: e.target.value })} /></div>
              <div className="form-field"><label>{t('date')}</label><input type="date" value={answerForm.date} onChange={e => setAnswerForm({ ...answerForm, date: e.target.value })} /></div>
              <div className="form-field full-width"><label>{t('document_pdf_word')}</label><div className="document-control"><label className="document-upload-button">{uploadingAnswer ? t('uploading') : t('choisir_fichier')}<input type="file" accept=".pdf,.doc,.docx" onChange={handleAnswerUpload} /></label><div className={answerForm.lienPdf ? "document-link-preview filled" : "document-link-preview"}><span>{answerForm.lienPdf ? getDocumentName(answerForm.lienPdf) : t('aucun_fichier')}</span>{answerForm.lienPdf && <a href={getDocumentHref(answerForm.lienPdf)} target="_blank" rel="noreferrer">{t('ouvrir')}</a>}</div><div className="document-link-input"><input type="text" value={answerForm.lienPdf} onChange={e => setAnswerForm({ ...answerForm, lienPdf: e.target.value })} placeholder={t('lien_manuel')} />{answerForm.lienPdf && <a href={getDocumentHref(answerForm.lienPdf)} target="_blank" rel="noreferrer">{t('ouvrir')}</a>}</div></div></div>
              <div className="form-field"><label className="checkbox-field"><input type="checkbox" checked={answerForm.estTransmissible} onChange={e => setAnswerForm({ ...answerForm, estTransmissible: e.target.checked })} /> {t('transmissible')}</label></div>
              <div className="form-field full-width"><label>{t('reponse')} *</label><textarea value={answerForm.description} onChange={e => setAnswerForm({ ...answerForm, description: e.target.value })} rows="4" required /></div>
            </div>
            <div className="form-actions"><button className="btn-primary" onClick={submitAnswer}>{t('envoyer')}</button><button className="btn-secondary" onClick={() => setShowAnswerModal(false)}>{t('annuler')}</button></div>
          </div>
        </div>
      )}

      {/* Multi Transfer Modal */}
      {showTransferModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowTransferModal(false)} />
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="registry-panel-header"><h3>{t('transferer')} : {transferTarget?.sujet || ''}</h3><button className="btn-secondary" onClick={() => setShowTransferModal(false)}>{t('fermer')}</button></div>
            <div className="form-grid">
              <div className="form-field full-width"><label>{t('ajouter_personnes_service')}</label><div style={{ display: 'flex', gap: '0.5rem' }}><select value={transferCurrentService} onChange={e => handleTransferServiceChange(e.target.value)} style={{ flex: 1 }}><option value="">-- {t('choisir_service')} --</option>{services.filter(s => s.idService !== serviceId).map(s => <option key={s.idService} value={s.idService}>{s.nomService}</option>)}</select><button className="btn-secondary" onClick={addCurrentSelection} disabled={!transferCurrentService || transferCurrentUserIds.length === 0}>{t('ajouter')}</button></div></div>
              {transferCurrentService && (<div className="form-field full-width"><label>{t('choisir_personnes')}</label><div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', padding: '0.5rem' }}>{allUsers.filter(u => u.idService === Number(transferCurrentService)).map(u => (<label key={u.id} className="transfer-user-label"><input type="checkbox" checked={transferCurrentUserIds.includes(u.id)} onChange={() => toggleCurrentUser(u.id)} /><span>{u.nomComplet}</span></label>))}</div></div>)}
              {transferSelections.length > 0 && (<div className="form-field full-width"><label>{t('personnes_selectionnees')}</label><div style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '0.5rem' }}>{transferSelections.map(sel => { const svc = services.find(s => s.idService === Number(sel.serviceId)); const svcName = svc ? svc.nomService : `Service #${sel.serviceId}`; return (<div key={sel.serviceId} style={{ marginBottom: '0.5rem', background: '#f9fbfd', padding: '0.5rem', borderRadius: '6px' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{svcName}</strong><button className="btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => removeSelection(sel.serviceId)}>✕</button></div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.3rem' }}>{allUsers.filter(u => sel.userIds.includes(u.id)).map(u => <span key={u.id} style={{ background: 'var(--soft-line)', padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.8rem' }}>{u.nomComplet}</span>)}</div></div>); })}</div></div>)}
              <div className="form-field full-width"><label className="checkbox-field"><input type="checkbox" checked={transferDoitRevenir} onChange={e => setTransferDoitRevenir(e.target.checked)} /> {t('doit_revenir')}</label></div>
              <div className="form-field full-width"><label>{t('message')}</label><textarea value={transferMessage} onChange={e => setTransferMessage(e.target.value)} rows="3" /></div>
            </div>
            <div className="form-actions"><button className="btn-primary" onClick={handleMultiTransfer} disabled={transferSelections.flatMap(s => s.userIds).length === 0}>{t('envoyer')} ({transferSelections.flatMap(s => s.userIds).length})</button><button className="btn-secondary" onClick={() => setShowTransferModal(false)}>{t('annuler')}</button></div>
          </div>
        </>
      )}

      {/* Single Transfer Modal */}
      {showSingleTransferModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowSingleTransferModal(false)} />
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3>{t('transferer')} : {singleTransferTarget?.sujet || ''}</h3>
            <div className="form-grid">
              <div className="form-field"><label>{t('service_destinataire')} *</label><select value={singleTransferServiceId} onChange={e => handleSingleServiceChange(e.target.value)}><option value="">--</option>{services.filter(s => s.idService !== serviceId).map(s => <option key={s.idService} value={s.idService}>{s.nomService}</option>)}</select></div>
              <div className="form-field"><label>{t('personne')} *</label><select value={singleTransferUserId} onChange={e => setSingleTransferUserId(e.target.value)}><option value="">--</option>{singleTransferUsers.map(u => <option key={u.id} value={u.id}>{u.nomComplet}</option>)}</select></div>
              <div className="form-field full-width"><label className="checkbox-field"><input type="checkbox" checked={singleTransferDoitRevenir} onChange={e => setSingleTransferDoitRevenir(e.target.checked)} /> {t('doit_revenir')}</label></div>
              <div className="form-field full-width"><label>{t('message')}</label><textarea value={singleTransferMessage} onChange={e => setSingleTransferMessage(e.target.value)} rows="3" /></div>
            </div>
            <div className="form-actions"><button className="btn-primary" onClick={handleSingleTransfer}>{t('envoyer')}</button><button className="btn-secondary" onClick={() => setShowSingleTransferModal(false)}>{t('annuler')}</button></div>
          </div>
        </>
      )}

      {/* Transfer Choice Modal */}
      {showTransferChoice && (
        <>
          <div className="modal-overlay" onClick={() => setShowTransferChoice(false)} />
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="registry-panel-header"><h3>{t('transfer_choice_title') || 'اختر طريقة الإحالة'}</h3><button className="btn-secondary" onClick={() => setShowTransferChoice(false)}>{t('fermer')}</button></div>
            <div className="form-actions" style={{ justifyContent: 'center', gap: '1rem' }}>
              <button className="btn-primary" onClick={() => handleTransferChoice('single')}>{t('transfer_to_one') || 'إلى شخص واحد'}</button>
              <button className="btn-primary" onClick={() => handleTransferChoice('multi')}>{t('transfer_to_many') || 'إلى عدة أشخاص'}</button>
            </div>
          </div>
        </>
      )}

      {/* View Reply Modal */}
      {showViewReplyModal && viewedReply && (
        <div className="modal-overlay" onClick={() => setShowViewReplyModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header"><h3>{t('reponse')}</h3><button className="btn-secondary" onClick={() => setShowViewReplyModal(false)}>{t('fermer')}</button></div>
            {!editingReply ? (
              <>
                <div className="form-grid"><div className="form-field"><label>{t('source')}</label><input value={viewedReply.source || ''} disabled /></div>{viewedReply.destinataire && <div className="form-field"><label>{t('destinataire')}</label><input value={viewedReply.destinataire} disabled /></div>}<div className="form-field"><label>{t('sujet')}</label><input value={viewedReply.sujet || ''} disabled /></div><div className="form-field"><label>{t('date')}</label><input value={formatDate(viewedReply.date)} disabled /></div>{viewedReply.lienPdf && <div className="form-field full-width"><label>{t('document_pdf_word')}</label><a href={getDocumentHref(viewedReply.lienPdf)} target="_blank" rel="noreferrer" className="btn-secondary">{t('ouvrir')}</a></div>}<div className="form-field full-width"><label>{t('description')}</label><textarea value={viewedReply.description || ''} disabled rows="4" /></div></div>
                <div className="form-actions">{(perms.canCreateAdministratif || perms.canCreateJuridique) && <button className="btn-primary" onClick={startEditingReply}>{t('modifier')}</button>}{viewedReply.estTransmissible !== false && perms.canTransfer && Number(viewedReply.idService) === Number(serviceId) && <button className="btn-primary" onClick={openTransferFromView}>{t('transferer')}</button>}<button className="btn-secondary" onClick={() => setShowViewReplyModal(false)}>{t('fermer')}</button></div>
              </>
            ) : (
              <>
                <div className="form-grid"><div className="form-field"><label>{t('source')}</label><input value={editReplyForm.source} onChange={e => setEditReplyForm({ ...editReplyForm, source: e.target.value })} /></div>{viewedReply.destinataire !== undefined && <div className="form-field"><label>{t('destinataire')}</label><input value={editReplyForm.destinataire} onChange={e => setEditReplyForm({ ...editReplyForm, destinataire: e.target.value })} /></div>}<div className="form-field"><label>{t('sujet')}</label><input value={editReplyForm.sujet} onChange={e => setEditReplyForm({ ...editReplyForm, sujet: e.target.value })} /></div><div className="form-field"><label>{t('date')}</label><input type="date" value={editReplyForm.date} onChange={e => setEditReplyForm({ ...editReplyForm, date: e.target.value })} /></div><div className="form-field full-width"><label>{t('description')}</label><textarea value={editReplyForm.description} onChange={e => setEditReplyForm({ ...editReplyForm, description: e.target.value })} rows="4" /></div></div>
                <div className="form-actions"><button className="btn-primary" onClick={saveEditedReply}>{t('save')}</button><button className="btn-secondary" onClick={cancelEditingReply}>{t('annuler')}</button></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal" style={{ maxWidth: '800px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="registry-panel-header"><h3>{t('historique_transactions')} : {historyDocumentTitle}</h3><button className="btn-secondary" onClick={() => setShowHistoryModal(false)}>{t('fermer')}</button></div>
            {historyTransactions.length === 0 ? <p className="text-muted">{t('aucune_transaction_acceptee')}</p> : (
              <div className="data-table-wrapper">
                <table className="modern-table">
                  <thead><tr><th>{t('date_envoi')}</th><th>{t('statut')}</th><th>{t('service_destinataire')}</th><th>{t('personne')}</th><th>{t('message')}</th><th>{t('reponse')}</th></tr></thead>
                  <tbody>{historyTransactions.map(tx => (<tr key={tx.id}><td>{new Date(tx.dateEnvoi).toLocaleString()}</td><td>{tx.statut}</td><td>{tx.destinationServiceName || '-'}</td><td>{tx.destinationUserName || '-'}</td><td style={{ whiteSpace: 'pre-wrap' }}>{tx.message || '-'}</td><td style={{ whiteSpace: 'pre-wrap' }}>{tx.messageReponse || '-'}</td></tr>))}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Withdrawal History Modal */}
      {showWithdrawModal && (
        <div className="modal-overlay" onClick={() => setShowWithdrawModal(false)}>
          <div className="modal" style={{ maxWidth: '800px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="registry-panel-header"><h3>{t('retraits')} : {withdrawDocumentTitle}</h3><button className="btn-secondary" onClick={() => setShowWithdrawModal(false)}>{t('fermer')}</button></div>
            {withdrawals.length === 0 ? <p className="text-muted">{t('aucun_retrait')}</p> : (
              <div className="data-table-wrapper">
                <table className="modern-table">
                  <thead><tr><th>{t('date_retrait')}</th><th>{t('motif_retrait')}</th><th>{t('effectue_par')}</th><th>{t('date_retour')}</th><th>{t('notes')}</th></tr></thead>
                  <tbody>{withdrawals.map(w => (<tr key={w.id}><td>{new Date(w.dateDeRetrait).toLocaleDateString()}</td><td>{w.motifDeRetrait || '-'}</td><td>{w.effectuePar || '-'}</td><td>{w.dateDeRetour ? new Date(w.dateDeRetour).toLocaleDateString() : '-'}</td><td>{w.notes || '-'}</td></tr>))}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Modal */}
      {showDocModal && currentDocument && <DocumentModal document={currentDocument} onClose={() => setShowDocModal(false)} />}
   
      {/* Duplicate warning modal */}
{showDuplicateWarning && (
  <div className="modal-overlay" onClick={() => setShowDuplicateWarning(false)}>
    <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
      <div className="registry-panel-header">
        <h3>{t('attention') || 'تنبيه'}</h3>
        <button className="btn-secondary" onClick={() => setShowDuplicateWarning(false)}>{t('fermer')}</button>
      </div>
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <p>{duplicateMessage}</p>
      </div>
      <div className="form-actions" style={{ justifyContent: 'center', gap: '1rem' }}>
        <button 
          className="btn-primary" 
          onClick={() => {
            setShowDuplicateWarning(false);
            if (pendingSubmit) pendingSubmit();
            setPendingSubmit(null);
          }}
        >
          {t('confirmer') || 'تأكيد'}
        </button>
        <button 
          className="btn-secondary" 
          onClick={() => {
            setShowDuplicateWarning(false);
            setPendingSubmit(null);
          }}
        >
          {t('annuler') || 'إلغاء'}
        </button>
      </div>
    </div>
  </div>
)}   


{successMessage.visible && (
  <div className="toast-message success">
    <span>{successMessage.text}</span>
    <button onClick={() => setSuccessMessage({ text: '', visible: false })}>✕</button>
  </div>
)}
{errorMessage.visible && (
  <div className="toast-message error">
    <span>{errorMessage.text}</span>
    <button onClick={() => setErrorMessage({ text: '', visible: false })}>✕</button>
  </div>
)}
    </div>
  );
}

// Helper functions
function formatDate(v) { if (!v) return '-'; return new Date(v).toLocaleDateString(); }
function getDocumentHref(v) { if (!v) return ''; if (/^https?:\/\//i.test(v)) return v; const nv = v.startsWith('/') ? v : `/${v}`; return window.location.hostname === 'localhost' && window.location.port === '3000' ? `http://localhost:5127${nv}` : nv; }
function getDocumentName(v) { if (!v) return ''; const clean = String(v).split('?')[0].split('#')[0]; return decodeURIComponent(clean.split('/').filter(Boolean).pop() || clean); }
function getErrorMessage(err, fb) { if (typeof err?.response?.data === 'string') return err.response.data; if (err?.response?.data?.message) return err.response.data.message; if (err?.message) return err.message; return fb; }

export default GestionCourriers;
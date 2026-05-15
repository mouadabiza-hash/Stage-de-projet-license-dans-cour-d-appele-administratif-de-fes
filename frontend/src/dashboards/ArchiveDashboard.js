import { Link } from 'react-router-dom';

function ArchiveDashboard() {
  return (
    <div>
      <h1>Tableau de bord – Archives</h1>
      <ul>
        <li><Link to="/courriers">Consulter les courriers</Link></li>
        <li><Link to="/archives-juridiques">Gérer les archives juridiques (retraits)</Link></li>
        <li><Link to="/mes-entites">Mes entités (archivage)</Link></li>
        <li><Link to="/transactions-outgoing">Registre des transactions</Link></li>
        <li><Link to="/notifications">Notifications</Link></li>
        <li><Link to="/equipements">Équipements (consultation)</Link></li>
        <li><Link to="/dossier-search">Recherche de dossiers</Link></li>
      </ul>
    </div>
  );
}

export default ArchiveDashboard;
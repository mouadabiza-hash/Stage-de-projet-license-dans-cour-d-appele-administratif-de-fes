import { Link } from 'react-router-dom';

function AdminDashboard() {
  return (
    <div>
      <h1>Tableau de bord – Administrateur</h1>
      <ul>
        <li><Link to="/courriers">Gérer les courriers</Link></li>
        <li><Link to="/archives-juridiques">Archives juridiques</Link></li>
        <li><Link to="/mes-entites">Mes entités</Link></li>
        <li><Link to="/transactions-outgoing">Registre des transactions</Link></li>
        <li><Link to="/notifications">Notifications</Link></li>
        <li><Link to="/equipements">Gérer les équipements</Link></li>
        <li><Link to="/services">Gérer les services</Link></li>
        <li><Link to="/utilisateurs">Gérer les utilisateurs</Link></li>
        <li><Link to="/dossier-search">Recherche de dossiers</Link></li>
      </ul>
    </div>
  );
}

export default AdminDashboard;
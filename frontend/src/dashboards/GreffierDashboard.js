import { Link } from 'react-router-dom';

function GreffierDashboard() {
  return (
    <div>
      <h1>Tableau de bord – Greffier</h1>
      <ul>
        <li><Link to="/courriers">Gérer les courriers (administratif & juridique)</Link></li>
        <li><Link to="/mes-entites">Mes entités</Link></li>
        <li><Link to="/transactions-outgoing">Registre des transactions</Link></li>
        <li><Link to="/notifications">Notifications</Link></li>
        <li><Link to="/equipements">Gérer les équipements</Link></li>
        <li><Link to="/dossier-search">Recherche de dossiers</Link></li>
      </ul>
    </div>
  );
}

export default GreffierDashboard;
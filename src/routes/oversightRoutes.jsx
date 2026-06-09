import { Navigate } from 'react-router-dom';
import CounterpartyRiskDashboard from '../pages/CounterpartyRiskDashboard';
import ScorecardPage from '../pages/ScorecardPage';
import AlertConfigurationPanel from '../pages/AlertConfigurationPanel';
import WatchlistPage from '../pages/WatchlistPage';
import ExecutiveDashboard from '../pages/ExecutiveDashboard';
import ReportsPage from '../pages/ReportsPage';

const oversightRoutes = [
  {
    path: 'counterparty-risk',
    element: <CounterpartyRiskDashboard />,
  },
  {
    path: 'counterparty-risk/scorecard/:counterpartyId',
    element: <ScorecardPage />,
  },
  {
    path: 'counterparty-risk/alerts',
    element: <AlertConfigurationPanel />,
  },
  {
    path: 'counterparty-risk/watchlist',
    element: <WatchlistPage />,
  },
  {
    path: 'executive',
    element: <ExecutiveDashboard />,
  },
  {
    path: 'reports',
    element: <ReportsPage />,
  },
  {
    path: '*',
    element: <Navigate to='counterparty-risk' replace />,
  },
];

export default oversightRoutes;
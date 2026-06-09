import { Navigate } from 'react-router-dom';
import LoanIntakePage from '../pages/LoanIntakePage';
import LoanDetailPage from '../pages/LoanDetailPage';
import RuleBuilderPage from '../pages/RuleBuilderPage';
import ExceptionQueuePage from '../pages/ExceptionQueuePage';
import QCQueuePage from '../pages/QCQueuePage';
import QCCaseReview from '../pages/QCCaseReview';
import SamplingConfigPage from '../pages/SamplingConfigPage';
import DefectListPage from '../pages/DefectListPage';
import TaxonomyManagerPage from '../pages/TaxonomyManagerPage';
import RemedyCaseListPage from '../pages/RemedyCaseListPage';
import RemedyCaseDetailPage from '../pages/RemedyCaseDetailPage';
import RepurchaseCaseListPage from '../pages/RepurchaseCaseListPage';
import RepurchaseCaseDetailPage from '../pages/RepurchaseCaseDetailPage';
import AuditLogViewer from '../pages/AuditLogViewer';

const operationsRoutes = [
  {
    path: 'intake',
    element: <LoanIntakePage />,
  },
  {
    path: 'intake/decision/:loanId',
    element: <LoanDetailPage />,
  },
  {
    path: 'rules',
    element: <RuleBuilderPage />,
  },
  {
    path: 'exceptions',
    element: <ExceptionQueuePage />,
  },
  {
    path: 'qc',
    element: <QCQueuePage />,
  },
  {
    path: 'qc/case/:caseId',
    element: <QCCaseReview />,
  },
  {
    path: 'qc/sampling',
    element: <SamplingConfigPage />,
  },
  {
    path: 'defects',
    element: <DefectListPage />,
  },
  {
    path: 'defects/taxonomy',
    element: <TaxonomyManagerPage />,
  },
  {
    path: 'remedy',
    element: <RemedyCaseListPage />,
  },
  {
    path: 'remedy/case/:caseId',
    element: <RemedyCaseDetailPage />,
  },
  {
    path: 'repurchases',
    element: <RepurchaseCaseListPage />,
  },
  {
    path: 'repurchases/case/:caseId',
    element: <RepurchaseCaseDetailPage />,
  },
  {
    path: 'audit',
    element: <AuditLogViewer />,
  },
  {
    path: '*',
    element: <Navigate to='intake' replace />,
  },
];

export default operationsRoutes;
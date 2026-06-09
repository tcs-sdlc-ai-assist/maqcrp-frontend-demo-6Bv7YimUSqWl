import PropTypes from 'prop-types';
import { SeedProvider } from '../contexts/SeedContext';
import { AuthProvider } from '../contexts/AuthContext';
import { MockDataProvider } from '../contexts/MockDataContext';
import { AuditProvider } from '../contexts/AuditContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { LoanProvider } from '../contexts/LoanContext';
import { RulesProvider } from '../contexts/RulesContext';
import { QCProvider } from '../contexts/QCContext';
import { DefectProvider } from '../contexts/DefectContext';
import { RemedyProvider } from '../contexts/RemedyContext';
import { RepurchaseProvider } from '../contexts/RepurchaseContext';
import { OversightProvider } from '../contexts/OversightContext';

const AppProvider = ({ children }) => {
  return (
    <SeedProvider>
      <AuthProvider>
        <MockDataProvider>
          <AuditProvider>
            <NotificationProvider>
              <LoanProvider>
                <RulesProvider>
                  <QCProvider>
                    <DefectProvider>
                      <RemedyProvider>
                        <RepurchaseProvider>
                          <OversightProvider>
                            {children}
                          </OversightProvider>
                        </RepurchaseProvider>
                      </RemedyProvider>
                    </DefectProvider>
                  </QCProvider>
                </RulesProvider>
              </LoanProvider>
            </NotificationProvider>
          </AuditProvider>
        </MockDataProvider>
      </AuthProvider>
    </SeedProvider>
  );
};

AppProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AppProvider;
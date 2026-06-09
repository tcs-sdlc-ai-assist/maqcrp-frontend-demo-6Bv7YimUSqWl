import { useAuth } from '../../contexts/AuthContext';
import PropTypes from 'prop-types';
import AccessDenied from './AccessDenied';

const RequireRole = ({ allowedRoles, children }) => {
  const { currentPersona } = useAuth();

  if (!currentPersona) {
    return (
      <AccessDenied
        requiredRoles={allowedRoles}
        currentRole={null}
        message='You must be logged in to access this page.'
      />
    );
  }

  const isAuthorized = allowedRoles.includes(currentPersona.id);

  if (!isAuthorized) {
    return (
      <AccessDenied
        requiredRoles={allowedRoles}
        currentRole={currentPersona.id}
      />
    );
  }

  return children;
};

RequireRole.propTypes = {
  allowedRoles: PropTypes.arrayOf(PropTypes.string).isRequired,
  children: PropTypes.node.isRequired,
};

export default RequireRole;
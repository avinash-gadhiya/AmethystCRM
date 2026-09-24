import PropTypes from 'prop-types';

import welcomeAnimation from 'assets/images/welcome-in-pastel.gif';

export default function LoginWelcomeOverlay({ userName }) {
  return (
    <div className="login-welcome-overlay" role="status" aria-live="polite" aria-label={`Welcome ${userName}`}>
      <div className="login-welcome-gif-stage">
        <img className="login-welcome-gif" src={welcomeAnimation} alt="Welcome" />
        <h2 className="login-welcome-user">{userName}</h2>
      </div>
    </div>
  );
}

LoginWelcomeOverlay.propTypes = {
  userName: PropTypes.string.isRequired
};

import { useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const WELCOME_ANIMATION_URL = 'https://lottie.host/bf3788db-478f-49c8-8d95-acb9e74fe0cd/lq5tFfnRcK.lottie';

export default function LoginWelcomeOverlay({ userName, onComplete }) {
  const playerRef = useRef(null);
  const completedRef = useRef(false);

  const finishWelcome = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  const setPlayerRef = useCallback(
    (player) => {
      if (playerRef.current) {
        playerRef.current.removeEventListener('complete', finishWelcome);
        playerRef.current.removeEventListener('loadError', finishWelcome);
      }

      playerRef.current = player;
      if (player) {
        player.addEventListener('complete', finishWelcome);
        player.addEventListener('loadError', finishWelcome);
      }
    },
    [finishWelcome]
  );

  useEffect(() => {
    const fallbackTimer = window.setTimeout(finishWelcome, 12000);

    return () => {
      window.clearTimeout(fallbackTimer);
      if (playerRef.current) {
        playerRef.current.removeEventListener('complete', finishWelcome);
        playerRef.current.removeEventListener('loadError', finishWelcome);
      }
    };
  }, [finishWelcome]);

  return (
    <div className="login-welcome-overlay" role="status" aria-live="polite" aria-label={`Welcome ${userName}`}>
      <div className="login-welcome-stage">
        <DotLottieReact
          className="login-welcome-lottie"
          src={WELCOME_ANIMATION_URL}
          autoplay
          segment={[0, 100]}
          dotLottieRefCallback={setPlayerRef}
        />
        <h2 className="login-welcome-user">{userName}</h2>
      </div>
    </div>
  );
}

LoginWelcomeOverlay.propTypes = {
  userName: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired
};

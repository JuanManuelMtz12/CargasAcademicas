import { useEffect, useState } from 'react';

export function useAntiScreenshot() {
  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    const blur = () => setIsBlurred(true);
    const unblur = () => setIsBlurred(false);

    const handleVisibility = () => {
      document.hidden ? blur() : unblur();
    };

    window.addEventListener('blur', blur);
    window.addEventListener('focus', unblur);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', unblur);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return isBlurred;
}

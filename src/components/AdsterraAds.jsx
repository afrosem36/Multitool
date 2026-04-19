import { useEffect, useRef } from 'react';

const NATIVE_CONTAINER_ID = 'container-0affe9b7ac519704f2c9c9147b84e06c';

const ensureGlobalScript = (id, src) => {
  if (document.getElementById(id)) {
    return;
  }

  const script = document.createElement('script');
  script.id = id;
  script.src = src;
  document.body.appendChild(script);
};

const AdsterraAds = () => {
  const nativeRef = useRef(null);
  const bannerRef = useRef(null);

  useEffect(() => {
    ensureGlobalScript(
      'adsterra-popunder-script',
      'https://pl29190085.profitablecpmratenetwork.com/45/17/01/451701fa0440a0b4ac66c929e5b7a227.js',
    );

    ensureGlobalScript(
      'adsterra-social-bar-script',
      'https://pl29190087.profitablecpmratenetwork.com/5d/06/09/5d0609f8b902788d53351b3e13890009.js',
    );

    if (nativeRef.current && !document.getElementById('adsterra-native-script')) {
      const script = document.createElement('script');
      script.id = 'adsterra-native-script';
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      script.src =
        'https://pl29190086.profitablecpmratenetwork.com/0affe9b7ac519704f2c9c9147b84e06c/invoke.js';
      nativeRef.current.appendChild(script);
    }

    if (bannerRef.current && !bannerRef.current.dataset.loaded) {
      bannerRef.current.dataset.loaded = 'true';
      window.atOptions = {
        key: '21f0c167614b42a68be89ef204721735',
        format: 'iframe',
        height: 60,
        width: 468,
        params: {},
      };

      const script = document.createElement('script');
      script.src = 'https://www.highperformanceformat.com/21f0c167614b42a68be89ef204721735/invoke.js';
      bannerRef.current.appendChild(script);
    }
  }, []);

  return (
    <section className="adsterra-stack" aria-label="Advertisements">
      <div className="adsterra-slot glass-panel">
        <div className="adsterra-slot-label">Sponsored</div>
        <div ref={nativeRef} className="adsterra-native-wrap">
          <div id={NATIVE_CONTAINER_ID} />
        </div>
      </div>

      <div className="adsterra-slot adsterra-banner-slot glass-panel">
        <div className="adsterra-slot-label">Sponsored</div>
        <div ref={bannerRef} className="adsterra-banner-wrap" />
      </div>
    </section>
  );
};

export default AdsterraAds;

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ADS_CONFIG } from '../../config';
import NativeBannerAd from './NativeBannerAd';
import './AdBanner.css';

const POSITION_CONFIGS = {
  top: { minHeight: 90, maxWidth: 970, className: 'is-banner' },
  sidebar: { minHeight: 250, maxWidth: 300, className: 'is-rectangle' },
  belowTool: { minHeight: 280, maxWidth: 970, className: 'is-banner' },
  belowToolMobile: { minHeight: 280, maxWidth: 480, className: 'is-mobile' },
  toolFooter: { minHeight: 140, maxWidth: 970, className: 'is-banner' },
  footer: { minHeight: 90, maxWidth: 970, className: 'is-banner' },
};

const DEFAULT_LABELS = {
  top: 'Sponsored placement',
  sidebar: 'Recommended partner',
  belowTool: 'Advertisement',
  belowToolMobile: 'Advertisement',
  toolFooter: 'Sponsored',
  footer: 'Sponsored message',
};

function getIdleScheduler() {
  if (typeof window === 'undefined') return (cb) => cb();
  return window.requestIdleCallback || ((cb) => window.setTimeout(cb, 1));
}

const AdBanner = ({ position = 'belowTool', className = '', label }) => {
  const containerRef = useRef(null);
  const adRef = useRef(null);
  const adUnitId = useId();
  const [isReady, setIsReady] = useState(false);
  const shouldUseNativeBanner = true;

  const slot = ADS_CONFIG.slots[position] || '';
  const config = POSITION_CONFIGS[position] || POSITION_CONFIGS.belowTool;
  const displayLabel = label || DEFAULT_LABELS[position] || DEFAULT_LABELS.belowTool;
  const canRenderNetworkAd = ADS_CONFIG.enabled && ADS_CONFIG.client && slot;

  const adKey = useMemo(
    () => `ad-slot-${position}-${slot || 'placeholder'}-${adUnitId.replace(/:/g, '')}`,
    [adUnitId, position, slot]
  );

  useEffect(() => {
    if (shouldUseNativeBanner) {
      return undefined;
    }

    if (!canRenderNetworkAd || !containerRef.current) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px 0px' }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [canRenderNetworkAd, shouldUseNativeBanner]);

  useEffect(() => {
    if (shouldUseNativeBanner) {
      return;
    }

    if (!canRenderNetworkAd || !isReady || !adRef.current || adRef.current.dataset.loaded === 'true') {
      return;
    }

    const schedule = getIdleScheduler();
    const run = () => {
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        adRef.current.dataset.loaded = 'true';
      } catch (error) {
        console.error('Ad slot render failed:', error);
      }
    };

    schedule(run);
  }, [canRenderNetworkAd, isReady, shouldUseNativeBanner]);

  if (shouldUseNativeBanner) {
    return <NativeBannerAd className={className} label={displayLabel} />;
  }

  return (
    <section
      ref={containerRef}
      className={`ad-container ad-${position} ${config.className} ${className}`.trim()}
      style={{ maxWidth: `${config.maxWidth}px`, minHeight: `${config.minHeight}px` }}
      aria-label={displayLabel}
    >
      <div className="ad-shell">
        <div className="ad-shell-header">{displayLabel}</div>
        {canRenderNetworkAd ? (
          <ins
            key={adKey}
            ref={adRef}
            className="adsbygoogle ad-unit"
            style={{ display: 'block' }}
            data-ad-client={ADS_CONFIG.client}
            data-ad-slot={slot}
            data-ad-format={position === 'sidebar' ? 'rectangle' : 'auto'}
            data-full-width-responsive={position === 'sidebar' ? 'false' : 'true'}
          />
        ) : (
          <div className="ad-fallback">
            <span>Ad slot reserved</span>
          </div>
        )}
      </div>
    </section>
  );
};

export default AdBanner;

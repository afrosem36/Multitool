import React, { useMemo } from 'react';

const NATIVE_SCRIPT_SRC = 'https://pl29272843.profitablecpmratenetwork.com/901844b2c58bc966a372462f1a945ad6/invoke.js';
const NATIVE_CONTAINER_ID = 'container-901844b2c58bc966a372462f1a945ad6';

const NativeBannerAd = ({ className = '', label = 'Sponsored' }) => {
  const iframeTitle = useMemo(
    () => `native-ad-${Math.random().toString(36).slice(2, 10)}`,
    []
  );
  const iframeMarkup = useMemo(
    () => `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              min-height: 100%;
              overflow: hidden;
              background: transparent;
            }

            #${NATIVE_CONTAINER_ID} {
              width: 100%;
              min-height: 120px;
            }
          </style>
        </head>
        <body>
          <script async="async" data-cfasync="false" src="${NATIVE_SCRIPT_SRC}"></script>
          <div id="${NATIVE_CONTAINER_ID}"></div>
        </body>
      </html>
    `,
    []
  );

  return (
    <section className={`ad-container ad-native ${className}`.trim()} aria-label={label}>
      <div className="ad-shell native-ad-shell">
        <div className="ad-shell-header">{label}</div>
        <div className="native-ad-body">
          <iframe
            title={iframeTitle}
            className="native-ad-frame"
            srcDoc={iframeMarkup}
            loading="lazy"
            scrolling="no"
          />
        </div>
      </div>
    </section>
  );
};

export default NativeBannerAd;

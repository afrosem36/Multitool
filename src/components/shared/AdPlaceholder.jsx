import React from 'react';
import AdBanner from './AdBanner';

const AdPlaceholder = ({ className = '', position = 'belowTool' }) => {
  return <AdBanner position={position} className={className} />;
};

export default AdPlaceholder;

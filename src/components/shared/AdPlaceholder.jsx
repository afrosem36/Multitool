import React from 'react';
import AdSenseUnit from './AdSenseUnit';

const AdPlaceholder = ({ className = '', position = 'belowTool' }) => {
  // Map positions to appropriate AdSense slots
  const getSlotForPosition = (pos) => {
    switch (pos) {
      case 'sidebar':
        return '1234567890'; // Rectangle ad
      case 'belowTool':
        return '9876543210'; // Banner ad
      case 'top':
        return '5555555555'; // Top banner
      case 'footer':
        return '1111111111'; // Footer banner
      default:
        return '9876543210'; // Default banner
    }
  };

  const getFormatForPosition = (pos) => {
    return pos === 'sidebar' ? 'rectangle' : 'auto';
  };

  const getResponsiveForPosition = (pos) => {
    return pos === 'sidebar' ? 'false' : 'true';
  };

  return (
    <AdSenseUnit
      slot={getSlotForPosition(position)}
      format={getFormatForPosition(position)}
      responsive={getResponsiveForPosition(position)}
      className={className}
    />
  );
};

export default AdPlaceholder;

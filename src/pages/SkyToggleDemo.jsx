import React from 'react';
import Switch from '../components/ui/sky-toggle';

const SkyToggleDemo = () => {
  return (
    <div style={{ 
      padding: '50px', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: '20px',
      minHeight: '100vh',
      background: '#f0f2f5'
    }}>
      <h1>Sky Toggle Demo</h1>
      <p>This is a custom theme toggle integrated into the project.</p>
      <div style={{ scale: '1.5' }}>
        <Switch />
      </div>
    </div>
  );
};

export default SkyToggleDemo;

import React from 'react';
import { motion } from 'framer-motion';
import { Globe, Server, MapPin, Signal } from 'lucide-react';

/**
 * NetworkInfo — displays ISP, IP, location, and connection type after a test.
 *
 * @param {object} props
 * @param {{ ip: string, isp: string, city: string, country: string, network: string }} props.info
 */
export default function NetworkInfo({ info }) {
  if (!info) return null;

  const rows = [
    { icon: Globe,  label: 'IP Address', value: info.ip },
    { icon: Server, label: 'ISP',        value: info.isp },
    {
      icon: MapPin,
      label: 'Location',
      value: [info.city, info.country].filter(Boolean).join(', ') || '—',
    },
    { icon: Signal, label: 'Connection', value: info.network },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="ist-network-info"
    >
      <p className="ist-section-label">Network Details</p>
      <div className="ist-network-grid">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="ist-network-row">
            <Icon size={13} className="ist-network-row__icon" />
            <div>
              <div className="ist-network-row__label">{label}</div>
              <div className="ist-network-row__value">{value}</div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

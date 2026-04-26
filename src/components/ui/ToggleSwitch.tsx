import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export default function ToggleSwitch({ checked, onChange, label, className }: ToggleSwitchProps) {
  return (
    <label className={`inline-flex items-center cursor-pointer gap-2 ${className || ''}`}>
      <input
        type="checkbox"
        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label && <span className="text-sm font-medium text-gray-900 dark:text-gray-300">{label}</span>}
    </label>
  );
}

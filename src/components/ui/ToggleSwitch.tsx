import React from 'react';
import styled from 'styled-components';

const SwitchWrapper = styled.label`
  position: relative;
  display: inline-flex;
  cursor: pointer;
  align-items: center;
  gap: 0.75rem;
`;

const HiddenInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
`;

const SwitchBackground = styled.div<{ $checked: boolean }>`
  position: relative;
  height: 1.75rem;
  width: 3rem;
  border-radius: 9999px;
  background-color: \${props => props.$checked ? '#4f46e5' : '#cbd5e1'};
  transition: background-color 0.2s ease-in-out;
  box-shadow: \${props => props.$checked ? '0 0 0 2px rgba(79, 70, 229, 0.2)' : 'none'};
`;

const SwitchKnob = styled.span<{ $checked: boolean }>`
  position: absolute;
  left: 0.25rem;
  top: 0.25rem;
  height: 1.25rem;
  width: 1.25rem;
  border-radius: 9999px;
  background-color: white;
  transition: transform 0.2s ease-in-out;
  transform: \${props => props.$checked ? 'translateX(1.25rem)' : 'translateX(0)'};
`;

const SwitchLabel = styled.span`
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
`;

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export default function ToggleSwitch({ checked, onChange, label, className }: ToggleSwitchProps) {
  return (
    <SwitchWrapper className={className}>
      <HiddenInput
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <SwitchBackground $checked={checked}>
        <SwitchKnob $checked={checked} />
      </SwitchBackground>
      {label && <SwitchLabel>{label}</SwitchLabel>}
    </SwitchWrapper>
  );
}

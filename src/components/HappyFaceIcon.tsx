import React from 'react';

interface HappyFaceIconProps {
  className?: string;
  color?: string;
  cheekColor?: string;
  style?: React.CSSProperties;
}

export const HappyFaceIcon: React.FC<HappyFaceIconProps> = ({
  className = 'w-6 h-6',
  color = '#FBBF24',
  cheekColor = '#FB7185',
  style,
}) => {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="21" fill={color} stroke="#0F172A" strokeWidth="2.5" />
      <circle cx="16.5" cy="20" r="2.6" fill="#0F172A" />
      <circle cx="31.5" cy="20" r="2.6" fill="#0F172A" />
      <ellipse cx="12.5" cy="25.5" rx="3" ry="1.8" fill={cheekColor} opacity="0.65" />
      <ellipse cx="35.5" cy="25.5" rx="3" ry="1.8" fill={cheekColor} opacity="0.65" />
      <path
        d="M15.5 27.5C17.2 32.2 20.5 34.5 24 34.5C27.5 34.5 30.8 32.2 32.5 27.5"
        stroke="#0F172A"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
};

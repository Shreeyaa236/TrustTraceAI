import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'status' | 'severity' | 'classification' | 'outline' | 'category';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'status', className = '' }) => {
  const text = String(children || '').trim();

  // Status mapping
  if (variant === 'status') {
    switch (text) {
      case 'Analysis Complete':
      case 'Supported by Available Evidence':
      case 'Consistent':
      case 'Resolved':
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EAF3EC] text-[#2D5A3A] border border-[#2D5A3A]/20 ${className}`}>
            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-[#2D5A3A]" />
            {children}
          </span>
        );
      case 'Review Required':
      case 'Partially Supported':
      case 'Under Review':
      case 'Processing':
      case 'Gaps Identified':
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEF3C7] text-[#B45309] border border-[#B45309]/20 ${className}`}>
            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-[#B45309]" />
            {children}
          </span>
        );
      case 'Contradicted':
      case 'Failed':
      case 'High':
      case 'Confirmed Finding':
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEE2E2] text-[#991B1B] border border-[#991B1B]/20 ${className}`}>
            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-[#991B1B]" />
            {children}
          </span>
        );
      case 'Not Analyzed':
      case 'Insufficient Evidence':
      case 'Dismissed':
      case 'Open':
      default:
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EFE6D8] text-[#725541] border border-[#E4D8C8] ${className}`}>
            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-[#725541]" />
            {children}
          </span>
        );
    }
  }

  // Severity mapping
  if (variant === 'severity') {
    switch (text) {
      case 'High':
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#FEE2E2] text-[#991B1B] border border-[#991B1B]/30 ${className}`}>
            HIGH
          </span>
        );
      case 'Medium':
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#FEF3C7] text-[#B45309] border border-[#B45309]/30 ${className}`}>
            MEDIUM
          </span>
        );
      case 'Low':
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#EAF3EC] text-[#2D5A3A] border border-[#2D5A3A]/30 ${className}`}>
            LOW
          </span>
        );
      case 'Informational':
      default:
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#EFE6D8] text-[#725541] border border-[#E4D8C8] ${className}`}>
            INFO
          </span>
        );
    }
  }

  // Classification mapping
  if (variant === 'classification') {
    if (text.includes('Text-Based')) {
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#EAF3EC] text-[#2D5A3A] border border-[#2D5A3A]/20 ${className}`}>
          {children}
        </span>
      );
    }
    if (text.includes('Image-Based')) {
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#FEF3C7] text-[#B45309] border border-[#B45309]/30 ${className}`}>
          {children}
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#EFE6D8] text-[#786C60] border border-[#E4D8C8] ${className}`}>
        {children}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-[#EFE6D8] text-[#49372C] ${className}`}>
      {children}
    </span>
  );
};

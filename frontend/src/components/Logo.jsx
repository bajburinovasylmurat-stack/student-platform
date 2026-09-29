import React from 'react';
import './Logo.css';

// JUZUP мәтіндік логотипі (фирмалық шрифтпен). light — қою фон үшін ақ нұсқасы
export default function Logo({ light = false, size = 'md', className = '' }) {
  return (
    <span className={`logo logo-${size} ${light ? 'logo-light' : ''} ${className}`} aria-label="JUZUP">
      <span className="logo-name" aria-hidden="true">
        JUZ<span className="logo-up">UP</span>
      </span>
      <span className="logo-sub" aria-hidden="true">by JUZ40</span>
    </span>
  );
}

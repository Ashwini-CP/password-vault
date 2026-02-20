import React from 'react';

function Navigation({ isAdmin }) {
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navItems = isAdmin 
    ? [
        { id: 'wallet', label: '💳 Account' },
        { id: 'upload', label: '📤 Upload Record' }
      ]
    : [
        { id: 'wallet', label: '💳 Account' },
        { id: 'consent', label: '📤 Share Records' },
        { id: 'view', label: '📥 View Records' },
        { id: 'audit', label: '📜 Activity' }
      ];

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <span className="brand-text">🏥 Health Vault</span>
          <span className="brand-subtitle">Secure Health Records</span>
        </div>
        <div className="nav-links">
          {navItems.map((item) => (
            <button
              key={item.id}
              className="nav-link"
              onClick={() => scrollToSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default Navigation;

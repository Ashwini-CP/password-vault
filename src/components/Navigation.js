import React from 'react';

function Navigation() {
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navItems = [
    { id: 'wallet', label: 'Wallet' },
    { id: 'consent', label: 'Patient Consent' },
    { id: 'view', label: 'View Record' },
    { id: 'audit', label: 'Audit Log' }
  ];

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <span className="brand-text">Healthcare Records</span>
          <span className="brand-subtitle">Blockchain Secured</span>
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

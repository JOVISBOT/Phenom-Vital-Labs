import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { companyInfo } from '../data/mock';

export const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Products', href: '#products' },
    { label: 'Quality', href: '#quality' },
    { label: 'Process', href: '#process' },
    { label: 'Contact', href: '#contact' }
  ];

  return (
    <header className="navigation-header">
      <a href="#" className="navigation-logo">
        {companyInfo.name}
      </a>

      {/* Desktop Navigation */}
      <nav className="navigation-menu desktop-nav">
        {navLinks.map((link) => (
          <a key={link.label} href={link.href} className="navigation-link">
            {link.label}
          </a>
        ))}
      </nav>

      <div className="navigation-utilities desktop-nav">
        <a href="#contact" className="btn-primary btn-header">
          Get Started
        </a>
      </div>

      {/* Mobile Menu Toggle */}
      <button
        className="mobile-menu-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="mobile-nav-overlay">
          <nav className="mobile-nav-menu">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a href="#contact" className="btn-primary" onClick={() => setMobileMenuOpen(false)}>
              Get Started
            </a>
          </nav>
        </div>
      )}
    </header>
  );
};

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { heroContent, companyInfo } from '../data/mock';

export const Hero = () => {
  return (
    <section className="hero-section">
      <div className="container">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="purity-badge">{companyInfo.purity} Purity</span>
          </div>
          
          <h1 className="hero-large">
            {heroContent.headline}
          </h1>
          
          <p className="hero-subheadline">
            {heroContent.subheadline}
          </p>
          
          <p className="body-large hero-description">
            {heroContent.description}
          </p>
          
          <div className="hero-cta">
            <a href="#products" className="btn-primary">
              {heroContent.cta}
              <ArrowRight size={16} />
            </a>
            <a href="#quality" className="btn-secondary">
              Learn About Our Process
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

import React from 'react';
import { Shield, BadgeCheck, FlaskConical } from 'lucide-react';
import { features } from '../data/mock';

const iconMap = {
  1: Shield,
  2: BadgeCheck,
  3: FlaskConical
};

export const Features = () => {
  return (
    <section className="features-section section-padding" id="quality">
      <div className="container">
        <div className="section-header">
          <h2 className="heading-1">Why Choose Phenom Vital Labs</h2>
          <p className="body-large section-subtitle">
            Uncompromising quality standards for research excellence
          </p>
        </div>
        
        <div className="features-grid">
          {features.map((feature) => {
            const Icon = iconMap[feature.id];
            return (
              <div key={feature.id} className="feature-card">
                <div className="feature-icon">
                  <Icon size={28} strokeWidth={1.5} />
                </div>
                <h3 className="heading-3">{feature.title}</h3>
                <p className="body-regular">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

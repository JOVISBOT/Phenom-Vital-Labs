import React from 'react';
import { ArrowRight } from 'lucide-react';
import { products } from '../data/mock';

export const Products = () => {
  return (
    <section className="products-section section-padding" id="products">
      <div className="container">
        <div className="section-header">
          <h2 className="heading-1">Our Peptide Range</h2>
          <p className="body-large section-subtitle">
            Research-grade compounds with verified purity
          </p>
        </div>
        
        <div className="products-grid">
          {products.map((product) => (
            <div key={product.id} className="product-card hover-lift">
              <div className="product-card-content">
                <div className="product-purity-badge">
                  {product.purity} Pure
                </div>
                <h3 className="product-card-title">{product.name}</h3>
                <p className="product-card-description">{product.description}</p>
                <button className="btn-icon">
                  View Details
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

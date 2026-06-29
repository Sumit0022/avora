import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
  return (
    <main>
      <section className="glass-panel" style={{ padding: '40px', textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '15px' }}>Track. Split. Settle.</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '30px', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 30px auto' }}>
          Welcome to Avora, your premium personal finance and flatmate expense sharing application.
        </p>
        <Link to="/login" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>Get Started</Link>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '10px', color: 'var(--brand-primary)' }}>Personal Finance</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Track your expenses, manage budgets, and monitor your net worth.</p>
        </div>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '10px', color: 'var(--brand-secondary)' }}>Group Engine</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Split bills with flatmates or friends seamlessly with smart debt simplification.</p>
        </div>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '10px', color: 'var(--success)' }}>Trip Management</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Manage group trips, itineraries, and shared travel expenses in one place.</p>
        </div>
      </div>
    </main>
  );
}

export default Home;

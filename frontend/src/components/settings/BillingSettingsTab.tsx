import React, { useState } from 'react';
import { CreditCard, Download, ShieldCheck, Zap } from 'lucide-react';
import { SettingsFormFooter } from './SettingsFormFooter';
import { useToast } from '../ui/ToastContainer';

export const BillingSettingsTab: React.FC = () => {
  const { showToast } = useToast();

  const [billingEmail, setBillingEmail] = useState('billing@enterprise.com');
  const [savedBillingEmail, setSavedBillingEmail] = useState('billing@enterprise.com');
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = billingEmail !== savedBillingEmail;

  const invoices = [
    { id: 'INV-2026-009', date: 'Sep 1, 2026', amount: '$4,200.00', status: 'Paid' },
    { id: 'INV-2026-008', date: 'Aug 1, 2026', amount: '$4,200.00', status: 'Paid' },
    { id: 'INV-2026-007', date: 'Jul 1, 2026', amount: '$4,200.00', status: 'Paid' },
  ];

  const handleDownloadInvoice = (id: string) => {
    showToast(`📥 Downloading PDF statement for ${id}…`, 'info');
  };

  const handleUpdatePayment = () => {
    showToast('💳 Payment gateway modal opened', 'info');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await new Promise((res) => setTimeout(res, 500));
      setSavedBillingEmail(billingEmail);
      showToast('Billing contact email updated!', 'success');
    } catch {
      showToast('Failed to update billing details.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setBillingEmail(savedBillingEmail);
    showToast('Billing changes discarded', 'info');
  };

  return (
    <div className="settings-panel" role="tabpanel" id="panel-billing" aria-labelledby="tab-billing">
      <div>
        <div className="settings-section-head">
          <h2 className="settings-section-title">Billing &amp; Subscription</h2>
          <p className="settings-section-desc">
            Manage your workspace subscription tier, payment credentials, and invoices.
          </p>
        </div>

        {/* ── Active Plan Card ── */}
        <div className="billing-plan-card">
          <div className="billing-plan-header">
            <div>
              <span className="billing-plan-badge">Enterprise Production</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', margin: '0.4rem 0 0.2rem 0' }}>
                Company Brain OS Dedicated Instance
              </h3>
              <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                Billed annually • Next renewal on October 1, 2027
              </span>
            </div>
            <button type="button" className="btn-secondary" onClick={() => showToast('Plan upgrade options opened', 'info')}>
              Upgrade Plan
            </button>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
              <span>Seat Usage: 14 of 50 Active Domain Approvers</span>
              <span>28% capacity</span>
            </div>
            <div className="billing-usage-bar-track">
              <div className="billing-usage-bar-fill" style={{ width: '28%' }} />
            </div>
          </div>
        </div>

        {/* ── Payment Method ── */}
        <section style={{ marginTop: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', marginBottom: '1rem' }}>
            Payment Method
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 42, height: 28, background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                <CreditCard size={18} />
              </div>
              <div>
                <strong style={{ fontSize: '0.875rem', color: '#ffffff', display: 'block' }}>
                  Visa ending in 4242
                </strong>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Expires 12/2028 • Primary Payment Method
                </span>
              </div>
            </div>

            <button type="button" className="btn-secondary" onClick={handleUpdatePayment}>
              Edit Card
            </button>
          </div>
        </section>

        {/* ── Billing Contact Email ── */}
        <section style={{ marginTop: '2rem' }}>
          <div className="settings-form-group">
            <label className="settings-label" htmlFor="billing-email-input">
              <span>Invoice Recipient Email</span>
            </label>
            <input
              id="billing-email-input"
              type="email"
              className="settings-input"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              placeholder="e.g. accounting@enterprise.com"
            />
          </div>
        </section>

        {/* ── Invoices History Table ── */}
        <section style={{ marginTop: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.75rem' }}>
            Billing History
          </h3>

          <div className="notifications-matrix-wrap">
            <table className="notifications-matrix-table" aria-label="Invoices history table">
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: '#ffffff' }}>{inv.id}</span>
                    </td>
                    <td>
                      <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>{inv.date}</span>
                    </td>
                    <td>
                      <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{inv.amount}</span>
                    </td>
                    <td>
                      <span className="badge ok" style={{ fontSize: '10px' }}>{inv.status}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => handleDownloadInvoice(inv.id)}
                      >
                        <Download size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <SettingsFormFooter
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
};

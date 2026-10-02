import React, { useState } from 'react';
import { Users, ShieldCheck, UserPlus, Copy, Check, Search, UserX } from 'lucide-react';
import { UserProfile } from '../../types';
import { getAuthToken } from '../../services/api';
import { useToast } from '../ui/ToastContainer';
import './ProfileView.view.css';

interface ProfileViewProps {
  user: UserProfile | null;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Member' | 'Auditor';
  domainScope: string;
  avatar: string;
  avatarBg: string;
  status: 'Active' | 'Invited';
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user }) => {
  const [copied, setCopied] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const { showToast } = useToast();
  const token =
    getAuthToken() ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbkBheGlvbW9zLmxvY2FsIiwicm9sZSI6ImFkbWluIiwiYXhpb21fZG9tYWluIjoiYWxsIn0...';

  const defaultPermissions = [
    'conflicts:read',
    'conflicts:write',
    'conflicts:approve',
    'conflicts:reject',
    'workflows:read',
    'workflows:execute',
    'audit:read',
    'audit:export',
    'intelligence:inspect',
    'pipeline:control',
    'integrations:manage',
    'settings:admin',
    'rbac:manage',
  ];

  const permissions = user?.permissions?.length ? user.permissions : defaultPermissions;

  // Team Directory
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    {
      id: 'usr-1',
      name: 'David Chen',
      email: 'admin@companybrain.local',
      role: 'Admin',
      domainScope: 'All Enterprise Domains',
      avatar: 'DC',
      avatarBg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      status: 'Active',
    },
    {
      id: 'usr-2',
      name: 'Sarah Jenkins',
      email: 'manager@companybrain.local',
      role: 'Manager',
      domainScope: 'Platform Engineering & Billing Specs',
      avatar: 'SJ',
      avatarBg: 'linear-gradient(135deg, #10b981, #059669)',
      status: 'Active',
    },
    {
      id: 'usr-3',
      name: 'Elena Rostova',
      email: 'security.lead@enterprise.com',
      role: 'Manager',
      domainScope: 'Security, IAM & OAuth Policies',
      avatar: 'ER',
      avatarBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
      status: 'Active',
    },
    {
      id: 'usr-4',
      name: 'Marcus Vance',
      email: 'auditor@companybrain.local',
      role: 'Auditor',
      domainScope: 'Database & Compliance Logs',
      avatar: 'MV',
      avatarBg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      status: 'Active',
    },
    {
      id: 'usr-5',
      name: 'Alex Rivera',
      email: 'alex.r@enterprise.com',
      role: 'Member',
      domainScope: 'Core Services & Documentation Read/Write',
      avatar: 'AR',
      avatarBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
      status: 'Active',
    },
    {
      id: 'usr-6',
      name: 'Rachel Kim',
      email: 'rachel.k@enterprise.com',
      role: 'Auditor',
      domainScope: 'Read-Only Cryptographic Audit Logs',
      avatar: 'RK',
      avatarBg: 'linear-gradient(135deg, #64748b, #475569)',
      status: 'Active',
    },
  ]);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    showToast('📋 Developer Bearer Token copied to clipboard!', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInviteMember = () => {
    showToast('✉️ Member invitation link generated and sent to email!', 'success');
  };

  const filteredMembers = teamMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.email.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.domainScope.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const roleClass: Record<TeamMember['role'], string> = {
    Admin: 'is-super',
    Manager: 'is-approver',
    Member: 'is-operator',
    Auditor: 'is-auditor',
  };

  const tiers = [
    {
      index: 'Tier 01',
      name: 'Super Administrator',
      cls: 'is-super',
      desc: 'Full workspace administration and configuration authority.',
    },
    {
      index: 'Tier 02',
      name: 'Domain Approver',
      cls: 'is-approver',
      desc: 'Authorizes patches and approves automated actions.',
    },
    {
      index: 'Tier 03',
      name: 'Operator / Contributor',
      cls: 'is-operator',
      desc: 'Standard workspace access and AI Copilot interaction.',
    },
    {
      index: 'Tier 04',
      name: 'Compliance Auditor',
      cls: 'is-auditor',
      desc: 'Read-only access to immutable audit logs.',
    },
  ];

  return (
    <div className="view-container profile-view">
      <header className="prof-head">
        <div className="prof-head-copy">
          <span className="prof-eyebrow">Layer 5 / Identity &amp; Governance</span>
          <h1 className="prof-title">Access &amp; Identity</h1>
          <p className="prof-sub">
            Manage workspace members and role-based permissions.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleInviteMember}>
          <UserPlus size={15} />
          <span>Invite Team Member</span>
        </button>
      </header>

      <div className="profile-layout-grid">
        {/* ── Active User Profile Card ── */}
        <section className="settings-card anim-slide-up">
          <div className="prof-identity">
            <div className="prof-avatar">EA</div>
            <div>
              <h3 className="prof-identity-name">{user?.display_name || 'Enterprise Admin'}</h3>
              <span className="prof-identity-email">{user?.email || 'admin@axiomos.local'}</span>
              <div>
                <span className="badge ok">SUPER ADMINISTRATOR</span>
              </div>
            </div>
          </div>

          <div className="prof-meta">
            <div className="prof-meta-row">
              <span className="prof-meta-key">Organization</span>
              <strong className="prof-meta-val">Axiom OS Enterprise (Production)</strong>
            </div>
            <div className="prof-meta-row">
              <span className="prof-meta-key">Domain Authority</span>
              <strong className="prof-meta-val is-brand">Full Override (All Domains)</strong>
            </div>
            <div className="prof-meta-row">
              <span className="prof-meta-key">Auth Method</span>
              <strong className="prof-meta-val">SSO / JWT Bearer (HS256)</strong>
            </div>
            <div className="prof-meta-row">
              <span className="prof-meta-key">2FA MFA Status</span>
              <strong className="prof-meta-val is-ok">Hardware Token Active</strong>
            </div>
          </div>
        </section>

        {/* ── Granted Permissions & Developer Token ── */}
        <section className="settings-card anim-slide-up">
          <div>
            <span className="prof-section-label">Access Grants</span>
            <h3 className="prof-card-title">Granted Permissions ({permissions.length} Active)</h3>
            <p className="prof-card-desc">
              Super Admin grants complete read, write, signoff, and autonomous Layer 0 execution authority.
            </p>
          </div>

          <div className="permissions-chips-grid">
            {permissions.map((perm) => (
              <span key={perm} className="perm-chip">
                {perm}
              </span>
            ))}
          </div>

          <div className="prof-token-block">
            <label className="prof-section-label">Developer API Bearer Token</label>
            <div className="prof-token-row">
              <input type="password" className="form-input" value={token} readOnly />
              <button className="btn btn-ghost" onClick={handleCopyToken}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── Team Members & Domain Approval Authority Directory ── */}
        <section className="settings-card full-width anim-slide-up">
          <div className="prof-toolbar">
            <div className="card-header-clean">
              <div className="card-header-icon">
                <Users size={18} />
              </div>
              <div>
                <span className="prof-section-label">Directory · {filteredMembers.length} of {teamMembers.length} members</span>
                <h3 className="prof-card-title">Team Directory &amp; Domain Approvers</h3>
                <p className="prof-card-desc">
                  Members with designated domain authority to sign off on Layer 0 self-healing diffs.
                </p>
              </div>
            </div>

            <div className="prof-search">
              <Search size={13} />
              <input
                type="text"
                className="form-input"
                placeholder="Filter team members…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="rules-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Team Member</th>
                  <th style={{ width: '160px' }}>System Role</th>
                  <th>Designated Domain Approval Scope</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length > 0 ? (
                  filteredMembers.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div className="prof-member">
                          <div className="prof-member-avatar" style={{ background: member.avatarBg }}>
                            {member.avatar}
                          </div>
                          <div>
                            <strong className="prof-member-name">{member.name}</strong>
                            <span className="prof-member-email">{member.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge prof-role ${roleClass[member.role]}`}>{member.role}</span>
                      </td>
                      <td>
                        <span className="prof-scope">{member.domainScope}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge ok" style={{ fontSize: '10px' }}>
                          {member.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <div className="prof-table-empty">
                        <UserX size={20} />
                        <span>No team members match “{searchFilter}”.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 4-Tier Enterprise RBAC Role Definitions ── */}
        <section className="settings-card full-width anim-slide-up">
          <div className="card-header-clean">
            <div className="card-header-icon" style={{ background: 'rgba(167, 139, 250, 0.12)', color: '#a78bfa', borderColor: 'rgba(167, 139, 250, 0.3)' }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <span className="prof-section-label">RBAC Architecture</span>
              <h3 className="prof-card-title">4-Tier Enterprise RBAC Permission Architecture</h3>
              <p className="prof-card-desc">
                Granular permission boundaries governing ingestion, contradiction resolution, and multi-system
                execution.
              </p>
            </div>
          </div>

          <div className="prof-tiers">
            {tiers.map((tier) => (
              <div key={tier.index} className="prof-tier">
                <span className="prof-tier-index">{tier.index}</span>
                <strong className={`prof-tier-name ${tier.cls}`}>{tier.name}</strong>
                <p className="prof-tier-desc">{tier.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

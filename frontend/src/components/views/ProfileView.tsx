import React, { useState } from 'react';
import {
  UserCheck,
  Key,
  Shield,
  Copy,
  Check,
  Users,
  ShieldCheck,
  UserPlus,
  Lock,
  Mail,
  Building,
  CheckCircle2,
  ExternalLink,
  Search,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { getAuthToken } from '../../services/api';
import { useToast } from '../ui/ToastContainer';

interface ProfileViewProps {
  user: UserProfile | null;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Domain Approver' | 'Operator' | 'Auditor';
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
      email: 'david.chen@enterprise.com',
      role: 'Super Admin',
      domainScope: 'All Enterprise Domains',
      avatar: 'DC',
      avatarBg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      status: 'Active',
    },
    {
      id: 'usr-2',
      name: 'Sarah Jenkins',
      email: 'sarah.j@enterprise.com',
      role: 'Domain Approver',
      domainScope: 'Platform Engineering & Billing Specs',
      avatar: 'SJ',
      avatarBg: 'linear-gradient(135deg, #10b981, #059669)',
      status: 'Active',
    },
    {
      id: 'usr-3',
      name: 'Elena Rostova',
      email: 'elena.r@enterprise.com',
      role: 'Domain Approver',
      domainScope: 'Security, IAM & OAuth Policies',
      avatar: 'ER',
      avatarBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
      status: 'Active',
    },
    {
      id: 'usr-4',
      name: 'Marcus Vance',
      email: 'marcus.v@enterprise.com',
      role: 'Domain Approver',
      domainScope: 'Database & Infrastructure Runbooks',
      avatar: 'MV',
      avatarBg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      status: 'Active',
    },
    {
      id: 'usr-5',
      name: 'Alex Rivera',
      email: 'alex.r@enterprise.com',
      role: 'Operator',
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

  return (
    <div className="view-container anim-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <span className="layer-chip l5">LAYER 5 IDENTITY &amp; GOVERNANCE</span>
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px', letterSpacing: '-0.02em' }}>
            Team Directory &amp; Access Roles
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Manage organizational team members, designated domain approvers, and role-based access control (RBAC).
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleInviteMember} style={{ padding: '10px 18px' }}>
          <UserPlus size={15} />
          <span>Invite Team Member</span>
        </button>
      </div>

      <div className="profile-layout-grid">
        {/* ── Active User Profile Card ── */}
        <div className="settings-card anim-slide-up">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: '19px',
                boxShadow: '0 0 16px rgba(59, 130, 246, 0.35)',
              }}
            >
              EA
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{user?.display_name || 'Enterprise Admin'}</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user?.email || 'admin@axiomos.local'}</span>
              <div style={{ marginTop: '5px' }}>
                <span className="badge ok">SUPER ADMINISTRATOR</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '10px', fontSize: '12.5px', marginTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Organization</span>
              <strong style={{ color: 'var(--text-main)' }}>Axiom OS Enterprise (Production)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Domain Authority</span>
              <strong style={{ color: '#38bdf8' }}>Full Override (All Domains)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Auth Method</span>
              <strong style={{ color: 'var(--text-main)' }}>SSO / JWT Bearer (HS256)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>2FA MFA Status</span>
              <strong style={{ color: '#34d399' }}>✓ Hardware Token Active</strong>
            </div>
          </div>
        </div>

        {/* ── Granted Permissions & Developer Token ── */}
        <div className="settings-card anim-slide-up">
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>
            Granted Permissions ({permissions.length} Active)
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Super Admin grants complete read, write, signoff, and autonomous Layer 0 execution authority.
          </p>

          <div className="permissions-chips-grid" style={{ marginTop: '12px' }}>
            {permissions.map((perm) => (
              <span key={perm} className="perm-chip">
                {perm}
              </span>
            ))}
          </div>

          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Developer API Bearer Token
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="password"
                className="form-input"
                value={token}
                readOnly
                style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px' }}
              />
              <button className="btn btn-ghost" onClick={handleCopyToken}>
                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Team Members & Domain Approval Authority Directory ── */}
        <div className="settings-card full-width anim-slide-up">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div className="card-header-clean">
              <div className="card-header-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                <Users size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Team Directory &amp; Domain Approvers</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Members with designated domain authority to sign off on Layer 0 self-healing diffs.
                </p>
              </div>
            </div>

            {/* Search filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative', width: '220px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Filter team members…"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{ paddingLeft: '28px', fontSize: '12px' }}
                />
                <Search size={13} style={{ position: 'absolute', left: '9px', top: '10px', color: 'var(--text-dim)' }} />
              </div>
            </div>
          </div>

          <div className="rules-table-wrapper" style={{ marginTop: '16px' }}>
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
                {filteredMembers.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: 'var(--radius-full)',
                            background: member.avatarBg,
                            color: '#fff',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 700,
                            fontSize: '11px',
                          }}
                        >
                          {member.avatar}
                        </div>
                        <div>
                          <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-main)' }}>
                            {member.name}
                          </strong>
                          <span style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>{member.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          fontSize: '10.5px',
                          background:
                            member.role === 'Super Admin'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : member.role === 'Domain Approver'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : member.role === 'Operator'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(100, 116, 139, 0.15)',
                          color:
                            member.role === 'Super Admin'
                              ? '#93c5fd'
                              : member.role === 'Domain Approver'
                              ? '#34d399'
                              : member.role === 'Operator'
                              ? '#fbbf24'
                              : '#cbd5e1',
                        }}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>{member.domainScope}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge ok" style={{ fontSize: '10px' }}>
                        {member.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 4-Tier Enterprise RBAC Role Definitions ── */}
        <div className="settings-card full-width anim-slide-up">
          <div className="card-header-clean">
            <div className="card-header-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700 }}>4-Tier Enterprise RBAC Permission Architecture</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Granular permission boundaries governing ingestion, contradiction resolution, and multi-system execution.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '16px' }}>
            <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
              <strong style={{ color: '#93c5fd', fontSize: '13.5px', display: 'block', marginBottom: '4px' }}>
                1. Super Administrator
              </strong>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                Full system authority. Manages LLM engines, overrides Layer 0 safety gates, configures webhooks, and provisions user roles.
              </p>
            </div>

            <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
              <strong style={{ color: '#34d399', fontSize: '13.5px', display: 'block', marginBottom: '4px' }}>
                2. Domain Approver
              </strong>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                Designated authority for specific squads. Authorizes documentation patches, signs off diffs, and dispatches Jira &amp; Slack updates.
              </p>
            </div>

            <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
              <strong style={{ color: '#fbbf24', fontSize: '13.5px', display: 'block', marginBottom: '4px' }}>
                3. Operator / Contributor
              </strong>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                Queries the AI Copilot, reads canonical knowledge base docs, submits manual contradiction reports, and comments on diffs.
              </p>
            </div>

            <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
              <strong style={{ color: '#cbd5e1', fontSize: '13.5px', display: 'block', marginBottom: '4px' }}>
                4. Compliance Auditor
              </strong>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                Read-only access to cryptographic hash-chained audit logs, SOC2 traceability reports, and historical drift analytics.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

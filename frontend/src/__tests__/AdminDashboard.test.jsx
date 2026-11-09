import { render, screen, waitFor } from '@testing-library/react';
import AdminDashboard from '../components/admin/AdminDashboard';
import AdminOverview from '../components/admin/AdminOverview';
import AdminUserManagement from '../components/admin/AdminUserManagement';

// Mock AuthContext
const mockAuthFetch = jest.fn();
let mockUser = {
  id: 'admin_123',
  email: 'admin@originalityguard.com',
  is_admin: true
};

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    authFetch: mockAuthFetch,
    user: mockUser,
    isAuthenticated: true
  })
}));

describe('Admin Dashboard & RBAC Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      id: 'admin_123',
      email: 'admin@originalityguard.com',
      is_admin: true
    };
  });

  test('blocks non-admin user and renders access denied alert', () => {
    mockUser.is_admin = false;

    render(<AdminDashboard onExitAdmin={jest.fn()} />);

    expect(screen.getByText(/Superadmin Access Required/i)).toBeInTheDocument();
    expect(screen.getByText(/Return to Application/i)).toBeInTheDocument();
  });

  test('renders superadmin portal header when user is admin', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        total_users: 120,
        active_pro_users: 28,
        total_scans_all_time: 1450,
        total_scans_today: 42,
        total_scans_month: 380,
        mrr_usd: 532.0,
        stripe_synced: true,
        daily_scans: [
          { date: '2026-10-01', scans: 12 },
          { date: '2026-10-02', scans: 25 }
        ],
        system_health: { database: 'connected' }
      })
    });

    render(<AdminDashboard onExitAdmin={jest.fn()} />);

    expect(screen.getByText(/Superadmin Control Portal/i)).toBeInTheDocument();
    expect(screen.getByText(/RBAC Level 1/i)).toBeInTheDocument();
    expect(screen.getByText(/User Directory/i)).toBeInTheDocument();
  });

  test('AdminOverview renders KPI cards and metrics accurately', () => {
    const mockStats = {
      total_users: 150,
      active_pro_users: 35,
      total_scans_all_time: 2100,
      total_scans_today: 55,
      total_scans_month: 620,
      mrr_usd: 665.0,
      stripe_synced: true,
      daily_scans: [
        { date: '2026-10-01', scans: 15 },
        { date: '2026-10-15', scans: 30 },
        { date: '2026-10-30', scans: 55 }
      ]
    };

    render(<AdminOverview stats={mockStats} onRefresh={jest.fn()} loading={false} />);

    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('35 Pro Subscribers')).toBeInTheDocument();
    expect(screen.getByText('$665.00')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '55' })).toBeInTheDocument();
    expect(screen.getByText(/Daily Scan Volume/i)).toBeInTheDocument();
  });

  test('AdminUserManagement lists users and allows searching', async () => {
    const mockUsersData = {
      users: [
        {
          id: 'u_1',
          email: 'student1@university.edu',
          is_admin: false,
          is_banned: false,
          subscription_tier: 'free',
          subscription_status: 'inactive',
          scan_credits: 3,
          created_at: '2026-10-10T10:00:00',
          total_scans: 4
        },
        {
          id: 'u_2',
          email: 'pro_researcher@mit.edu',
          is_admin: false,
          is_banned: false,
          subscription_tier: 'pro',
          subscription_status: 'active',
          scan_credits: 100,
          created_at: '2026-10-12T12:00:00',
          total_scans: 28
        }
      ],
      total: 2,
      page: 1,
      pages: 1
    };

    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsersData
    });

    render(<AdminUserManagement />);

    await waitFor(() => {
      expect(screen.getByText('student1@university.edu')).toBeInTheDocument();
      expect(screen.getByText('pro_researcher@mit.edu')).toBeInTheDocument();
      expect(screen.getByText('PRO')).toBeInTheDocument();
    });
  });
});

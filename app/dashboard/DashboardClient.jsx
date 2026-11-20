'use client';
import dynamic from 'next/dynamic';

// Shift, full-screen mode and viewing preferences belong to the shop-floor browser.
const Dashboard = dynamic(() => import('./DashboardContent').then(m => m.DashboardContent), {
  ssr: false,
  loading: () => <p role="status">Membuka Dashboard Welding…</p>
});
export default Dashboard;

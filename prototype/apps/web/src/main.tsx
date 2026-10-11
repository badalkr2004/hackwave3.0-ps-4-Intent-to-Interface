import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design/base.css';
import { AnalyticsPage } from './analytics/AnalyticsPage';
import { App } from './App';
import { LoginPage } from './auth/LoginPage';
import { OnboardPage } from './auth/OnboardPage';
import { SignupPage } from './auth/SignupPage';
import { ChatPage } from './chat/ChatPage';
import { ConnectorsPage } from './connectors/ConnectorsPage';
import { Gallery } from './gallery/Gallery';
import { LandingPage } from './landing/LandingPage';
import { OrgHub } from './org/OrgHub';
import { AppErrorBoundary } from './shell/AppErrorBoundary';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

const path = window.location.pathname;

function pageFor(pathname: string) {
  if (pathname === '/' || pathname === '') return <LandingPage />;
  if (pathname.startsWith('/app')) return <App />;
  if (pathname.startsWith('/chat')) return <ChatPage />;
  if (pathname.startsWith('/gallery')) return <Gallery />;
  if (pathname.startsWith('/login')) return <LoginPage />;
  if (pathname.startsWith('/signup')) return <SignupPage />;
  if (pathname.startsWith('/onboard')) return <OnboardPage />;
  if (pathname.startsWith('/analytics')) return <AnalyticsPage />;
  if (pathname.startsWith('/org')) return <OrgHub />;
  if (pathname.startsWith('/connectors')) return <ConnectorsPage />;
  return <LandingPage />;
}

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>{pageFor(path)}</AppErrorBoundary>
  </StrictMode>,
);

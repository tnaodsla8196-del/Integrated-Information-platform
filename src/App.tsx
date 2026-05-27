import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';

export default function App() {
  // Always load dashboard directly without Google login popup
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#F8FAFC] relative">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/:tabId" element={<Dashboard token="PUBLIC_MODE" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { CareerMatchProvider } from './context/CareerMatchContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { Footer } from './components/ui';
import Home from './pages/Home';
import Opportunities from './pages/Opportunities';
import OpportunityMap from './pages/OpportunityMap';
import SkillGap from './pages/SkillGap';
import Profile from './pages/Profile';
import Company from './pages/Company';
import College from './pages/College';
import Ministry from './pages/Ministry';
import Login from './pages/Login';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <CareerMatchProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/opportunities" element={<Opportunities />} />
                  <Route path="/map" element={<OpportunityMap />} />
                  <Route path="/skill-gap" element={<ProtectedRoute roles={['student']}><SkillGap /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute roles={['student']}><Profile /></ProtectedRoute>} />
                  <Route path="/company" element={<ProtectedRoute roles={['company']}><Company /></ProtectedRoute>} />
                  <Route path="/college" element={<ProtectedRoute roles={['college']}><College /></ProtectedRoute>} />
                  <Route path="/ministry" element={<ProtectedRoute roles={['ministry']}><Ministry /></ProtectedRoute>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </CareerMatchProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

import './App.css'
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './Pages/Home';
import Screener from './Pages/Screener';
import Summarizer from './Pages/Summarizer';
import Login from './Pages/Login';
import Register from './Pages/Register';
import { GoogleOAuthProvider } from '@react-oauth/google';
import PythonConnectionTest from "./Pages/PythonConnectionTest";
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" />;
  return children;
};

function App() {
  return (
    
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <Routes>
        {/* Public routes */}
        <Route path="/pythonTest" element={<PythonConnectionTest />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/screener" element={<ProtectedRoute><Screener /></ProtectedRoute>} />
        <Route path="/summarizer" element={<ProtectedRoute><Summarizer /></ProtectedRoute>} />
      </Routes>
    </GoogleOAuthProvider>
  );
}

export default App;
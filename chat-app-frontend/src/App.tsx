/** @format */
// No changes needed if it already uses the correct component name
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChatPage from "./pages/Chat"; // Ensure this uses ChatPage
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth(); // Check loading state

  if (loading) {
    // Optional: Show a loading spinner while checking auth state
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />; // Use replace to prevent history buildup
  }
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <WebSocketProvider> {/* WebSocketProvider wraps routes needing socket */}
          <div className="h-screen w-full bg-gray-100 dark:bg-gray-900">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <ChatPage /> {/* Use ChatPage component */}
                  </ProtectedRoute>
                }
              />
               {/* Optional: Add a catch-all route */}
               <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </WebSocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios'; // Import axios for verification

// --- Interfaces (remain the same) ---
interface User {
  id: string; // Changed from _id to id to match backend response consistency
  username: string;
  email: string;
  profilePic?: string;
  status?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<boolean>; // Return boolean for success
  register: (username: string, email: string, password: string) => Promise<boolean>; // Return boolean for success
  logout: () => void;
  loading: boolean; // Indicates initial auth check
  error: string | null;
}

// --- Context Creation (remains the same) ---
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- useAuth Hook (remains the same) ---
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// --- AuthProvider Component ---
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // Start loading true
  const [error, setError] = useState<string | null>(null);

  // Function to clear auth state and storage
  const logout = useCallback(() => {
    console.log("Logging out...");
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setError(null); // Clear errors on logout
     // Optionally: Force redirect via window.location if router context isn't available/reliable here
    // window.location.href = '/login';
  }, []); // Added useCallback

  // **Effect to verify token on initial load**
  useEffect(() => {
    const verifyStoredAuth = async () => {
      console.log("AuthProvider: Checking stored auth...");
      const storedUserString = localStorage.getItem('user');
      const storedToken = localStorage.getItem('token');

      if (storedUserString && storedToken) {
        console.log("AuthProvider: Found stored token. Verifying...");
        try {
          // Temporarily set state to avoid login flicker if token is valid
          setToken(storedToken);
          // setUser(JSON.parse(storedUserString)); // Maybe set user later after verification

          // **Verify token with backend /api/auth/me endpoint**
          const response = await axios.get('http://localhost:8000/api/auth/me', {
            headers: { Authorization: `Bearer ${storedToken}` }
          });

          if (response.status === 200 && response.data) {
             console.log("AuthProvider: Token verified. User:", response.data);
             // Use fresh user data from backend
             const verifiedUser: User = {
                 id: response.data._id || response.data.id, // Handle both _id and id
                 username: response.data.username,
                 email: response.data.email,
                 profilePic: response.data.profilePic,
                 status: response.data.status
             };
            setUser(verifiedUser);
            setToken(storedToken); // Confirm token is valid
            // Update local storage user data if backend data differs (optional)
            // localStorage.setItem('user', JSON.stringify(verifiedUser));
          } else {
            // Backend didn't return user data or status wasn't 200
            console.warn("AuthProvider: Backend verification failed (unexpected response). Logging out.");
            logout();
          }
        } catch (err) {
            console.error("AuthProvider: Token verification failed.", err);
             if (axios.isAxiosError(err) && err.response?.status === 401) {
                console.log("AuthProvider: Stored token is invalid or expired. Logging out.");
             } else {
                 console.error("AuthProvider: Error during token verification request:", err);
                 setError("Could not verify session. Please log in again."); // Set an error message
             }
             logout(); // Logout if token verification fails for any reason
        }
      } else {
         console.log("AuthProvider: No stored user/token found.");
         // Ensure state is cleared if no stored data exists
         setUser(null);
         setToken(null);
      }

      setLoading(false); // Finish loading *after* verification attempt
    };

    verifyStoredAuth();
  }, [logout]); // Depend on logout callback

  // --- Login Function ---
  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true); // Indicate loading during login attempt
    setError(null);
    console.log(`AuthProvider: Attempting login for ${email}...`);
    try {
      const response = await axios.post('http://localhost:8000/api/auth/login', { email, password });

      if (response.status === 200 && response.data && response.data.user && response.data.token) {
        const userData = response.data.user;
        const receivedToken = response.data.token;

        const loggedInUser: User = {
             id: userData.id, // Assuming backend sends 'id' now
             username: userData.username,
             email: userData.email,
             profilePic: userData.profilePic,
             status: userData.status
         };

        setUser(loggedInUser);
        setToken(receivedToken);

        localStorage.setItem('user', JSON.stringify(loggedInUser));
        localStorage.setItem('token', receivedToken);
        console.log(`AuthProvider: Login successful for ${email}`);
        setLoading(false);
        return true; // Indicate success
      } else {
         // Handle cases where login might succeed with 200 but data is missing
         throw new Error(response.data?.message || 'Login failed: Invalid response from server');
      }

    } catch (err) {
      console.error("AuthProvider: Login failed.", err);
       const errorMessage = axios.isAxiosError(err)
            ? (err.response?.data?.message || err.message)
            : (err instanceof Error ? err.message : 'Login failed: An unknown error occurred');
      setError(errorMessage);
      logout(); // Ensure cleanup on failed login
      setLoading(false);
      return false; // Indicate failure
    }
  };

  // --- Register Function ---
  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    setLoading(true); // Indicate loading
    setError(null);
     console.log(`AuthProvider: Attempting registration for ${username}...`);
    try {
       const response = await axios.post('http://localhost:8000/api/auth/register', { username, email, password });

       if (response.status === 201 && response.data && response.data.user && response.data.token) {
           const userData = response.data.user;
           const receivedToken = response.data.token;

           const registeredUser: User = {
               id: userData.id, // Assuming backend sends 'id'
               username: userData.username,
               email: userData.email,
               profilePic: userData.profilePic,
               status: userData.status
           };

           setUser(registeredUser);
           setToken(receivedToken);

           localStorage.setItem('user', JSON.stringify(registeredUser));
           localStorage.setItem('token', receivedToken);
           console.log(`AuthProvider: Registration successful for ${username}`);
           setLoading(false);
           return true; // Indicate success
        } else {
             throw new Error(response.data?.message || 'Registration failed: Invalid response from server');
        }

    } catch (err) {
      console.error("AuthProvider: Registration failed.", err);
        const errorMessage = axios.isAxiosError(err)
            ? (err.response?.data?.message || err.message)
            : (err instanceof Error ? err.message : 'Registration failed: An unknown error occurred');
      setError(errorMessage);
      logout(); // Ensure cleanup on failed registration
      setLoading(false);
      return false; // Indicate failure
    }
  };


  const value = {
    user,
    token,
    login,
    register,
    logout,
    loading, // Expose loading state for ProtectedRoute
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
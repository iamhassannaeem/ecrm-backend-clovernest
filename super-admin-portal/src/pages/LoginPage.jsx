import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../services/api";

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    try {
      const res = await authAPI.login({ email, password });
      console.log('Login response:', res.data); // Debug log
      
      if (res.data && res.data.tokens && res.data.tokens.accessToken) {
        console.log('Storing access token:', res.data.tokens.accessToken.substring(0, 20) + '...'); // Debug log
        localStorage.setItem("superadmin_token", res.data.tokens.accessToken);
        console.log('Token stored, navigating to analytics...'); 
        
        // Update authentication state in parent component
        if (onLoginSuccess) {
          onLoginSuccess();
        }
        
        navigate("/analytics");
      } else if (res.data && res.data.token) {
        // Fallback for different response structure
        console.log('Using fallback token structure'); // Debug log
        localStorage.setItem("superadmin_token", res.data.token);
        
        if (onLoginSuccess) {
          onLoginSuccess();
        }
        
        navigate("/analytics");
      } else {
        console.error('Invalid response structure:', res.data); // Debug log
        setError("Invalid response structure from server");
      }
    } catch (err) {
      console.error('Login error:', err); // Debug log
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Super Admin Portal</h1>
          <p className="text-gray-600">Sign in to your account</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
} 
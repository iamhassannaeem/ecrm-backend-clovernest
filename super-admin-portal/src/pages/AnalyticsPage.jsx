import React, { useEffect, useState } from "react";
import { analyticsAPI } from "../services/api";
import { TrendingUp, Users, Building2, Activity } from "lucide-react";

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await analyticsAPI.getAnalytics();
        setData(res.data.analytics);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">Error Loading Analytics</div>
          <div className="text-gray-600">{error}</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Platform Analytics</h1>
        <p className="text-gray-600">Overview of your platform's performance and metrics</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard 
          label="Total Users" 
          value={data.totalUsers} 
          icon={Users}
          color="blue"
        />
        <StatCard 
          label="Total Organizations" 
          value={data.totalOrganizations} 
          icon={Building2}
          color="green"
        />
        <StatCard 
          label="Recent Users (30d)" 
          value={data.recentUsers} 
          icon={TrendingUp}
          color="indigo"
        />
        <StatCard 
          label="Recent Organizations (30d)" 
          value={data.recentOrganizations} 
          icon={Activity}
          color="pink"
        />
      </div>
      
      <div className="card">
        <div className="text-sm text-gray-500">
          Last updated: {new Date(data.generatedAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    yellow: "bg-yellow-50 text-yellow-600",
    indigo: "bg-indigo-50 text-indigo-600",
    pink: "bg-pink-50 text-pink-600",
  };

  return (
    <div className="card hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
} 
'use client';

import { useState } from 'react';
import DataUploadPanel from '@/components/DataUploadPanel';
import { Settings, Database, Upload } from 'lucide-react';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'settings' | 'database'>('upload');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600 mt-1">Manage your analytics data and settings</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-4 px-2 font-semibold border-b-2 transition-colors ${
                activeTab === 'upload'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Upload className="w-5 h-5 inline-block mr-2" />
              Upload Data
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`py-4 px-2 font-semibold border-b-2 transition-colors ${
                activeTab === 'database'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Database className="w-5 h-5 inline-block mr-2" />
              Database
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-4 px-2 font-semibold border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="w-5 h-5 inline-block mr-2" />
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'upload' && (
          <div>
            <DataUploadPanel />
          </div>
        )}

        {activeTab === 'database' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">🗄️ Database Configuration</h2>

            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-semibold text-blue-900 mb-4">MongoDB Setup Instructions</h3>
                <ol className="space-y-3 text-blue-800">
                  <li>
                    <strong>1. Create MongoDB Account</strong>
                    <p className="text-sm mt-1">
                      Go to <a href="https://www.mongodb.com/cloud/atlas" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        MongoDB Atlas
                      </a>{' '}
                      and create a free account
                    </p>
                  </li>
                  <li>
                    <strong>2. Create a Cluster</strong>
                    <p className="text-sm mt-1">Create a new M0 (free) cluster in your preferred region</p>
                  </li>
                  <li>
                    <strong>3. Get Connection String</strong>
                    <p className="text-sm mt-1">
                      Click "Connect" and copy your connection string (looks like: mongodb+srv://username:password@cluster.mongodb.net/database)
                    </p>
                  </li>
                  <li>
                    <strong>4. Add to Environment Variables</strong>
                    <p className="text-sm mt-1">Add to your <code className="bg-white px-2 py-1 rounded">.env.local</code> file:</p>
                    <code className="block bg-white px-3 py-2 rounded mt-2 text-xs overflow-x-auto">
                      MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ecommerce-analytics?retryWrites=true&w=majority
                    </code>
                  </li>
                  <li>
                    <strong>5. Restart Dev Server</strong>
                    <p className="text-sm mt-1">Restart your Next.js dev server to pick up the new environment variable</p>
                  </li>
                </ol>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="font-semibold text-green-900 mb-4">✅ Connection Status</h3>
                <p className="text-green-800">
                  To check if MongoDB is connected, upload a CSV file. If successful, your data will be stored in MongoDB.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">⚙️ Settings</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Dashboard Title</label>
                <input
                  type="text"
                  defaultValue="E-commerce Analytics Dashboard"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Data Refresh Interval (minutes)</label>
                <input
                  type="number"
                  defaultValue="60"
                  min="5"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Enable Notifications</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4" />
                  <span className="text-gray-700">Send email notifications on data upload</span>
                </label>
              </div>

              <button className="px-6 py-2 bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-600 transition-colors">
                Save Settings
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

'use client';

import { Database, Upload, Zap } from 'lucide-react';

export default function BackendSetupOptions() {
  const options = [
    {
      id: 1,
      title: 'Set Up Database Connection',
      description: 'Connect your MongoDB, PostgreSQL, Firebase, or MySQL database to store analytics data.',
      icon: Database,
      steps: [
        'Choose your database (MongoDB, PostgreSQL, Firebase, MySQL)',
        'Add connection string to environment variables',
        'Update /app/api/dashboard/data/route.ts to query from database',
        'Test the connection',
      ],
      color: 'from-blue-500 to-blue-600',
    },
    {
      id: 2,
      title: 'Create Data Upload Pipeline',
      description: 'Process your CSV datasets and upload them to the database automatically.',
      icon: Upload,
      steps: [
        'Use scripts/process-datasets.ts to transform CSV files',
        'Create API endpoint for data ingestion',
        'Set up scheduled jobs (daily/weekly) for automatic updates',
        'Monitor data quality and error logs',
      ],
      color: 'from-teal-500 to-teal-600',
    },
    {
      id: 3,
      title: 'Implement Real Data Integration',
      description: 'Connect your processed datasets and enable live analytics with sentiment analysis.',
      icon: Zap,
      steps: [
        'Run sentiment analysis on review text',
        'Detect fake reviews using ML algorithms',
        'Aggregate metrics by product and time period',
        'Deploy and monitor dashboard performance',
      ],
      color: 'from-emerald-500 to-emerald-600',
    },
  ];

  return (
    <section className="py-12 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Backend Setup Guide</h2>
          <p className="text-lg text-gray-600">
            Follow these 3 steps to connect your real datasets and enable live analytics
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {options.map((option, index) => {
            const Icon = option.icon;
            return (
              <div
                key={option.id}
                className="group relative bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
              >
                {/* Gradient background */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${option.color}`} />

                {/* Step number badge */}
                <div className="absolute top-4 right-4 w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-700">{index + 1}</span>
                </div>

                <div className="p-8">
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${option.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Title and Description */}
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{option.title}</h3>
                  <p className="text-gray-600 mb-6 text-sm leading-relaxed">{option.description}</p>

                  {/* Steps */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Implementation Steps</p>
                    <ul className="space-y-2">
                      {option.steps.map((step, stepIndex) => (
                        <li key={stepIndex} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-semibold text-gray-600">{stepIndex + 1}</span>
                          </div>
                          <span className="text-sm text-gray-700 leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Button */}
                  <button className={`w-full mt-8 py-3 px-4 rounded-lg bg-gradient-to-r ${option.color} text-white font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105`}>
                    Learn More →
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional Info */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-8">
          <h3 className="text-lg font-bold text-blue-900 mb-4">📚 Documentation & Resources</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">Data Processing Script</h4>
              <p className="text-sm text-blue-800">
                Located at <code className="bg-white px-2 py-1 rounded">scripts/process-datasets.ts</code> - Process your CSV files here
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">API Routes</h4>
              <p className="text-sm text-blue-800">
                Update <code className="bg-white px-2 py-1 rounded">/app/api/dashboard/data/route.ts</code> to query your database
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">Environment Variables</h4>
              <p className="text-sm text-blue-800">
                Add database credentials to <code className="bg-white px-2 py-1 rounded">.env.local</code> file
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

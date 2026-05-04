'use client';

import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle, Loader } from 'lucide-react';

export default function DataUploadPanel() {
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'reviews' | 'sales'>('reviews');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      await uploadFile(files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files[0]) {
      await uploadFile(files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setMessage({ type: 'error', text: 'Please upload a CSV file' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', uploadType);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: `✅ Successfully uploaded ${data.processedCount} records! Refresh the dashboard to see updates.`,
        });
        // Refresh dashboard data
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setMessage({ type: 'error', text: `❌ Upload failed: ${data.error}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `❌ Upload error: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">📤 Upload Your Data</h2>

      {/* Upload Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">Select Data Type</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="uploadType"
              value="reviews"
              checked={uploadType === 'reviews'}
              onChange={(e) => setUploadType(e.target.value as 'reviews' | 'sales')}
              className="w-4 h-4"
            />
            <span className="text-gray-700">Reviews Data</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="uploadType"
              value="sales"
              checked={uploadType === 'sales'}
              onChange={(e) => setUploadType(e.target.value as 'reviews' | 'sales')}
              className="w-4 h-4"
            />
            <span className="text-gray-700">Sales Data</span>
          </label>
        </div>
      </div>

      {/* Drag and Drop Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive ? 'border-teal-500 bg-teal-50' : 'border-gray-300 bg-gray-50 hover:border-teal-400'
        }`}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-lg font-semibold text-gray-900 mb-2">Drag and drop your CSV file here</p>
        <p className="text-gray-600 mb-4">or</p>
        <label className="inline-block">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            disabled={uploading}
            className="hidden"
          />
          <span className="inline-block px-6 py-2 bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-600 cursor-pointer transition-colors disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Select File'}
          </span>
        </label>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>{message.text}</p>
        </div>
      )}

      {/* Loading State */}
      {uploading && (
        <div className="mt-6 flex items-center justify-center gap-3 text-teal-600">
          <Loader className="w-5 h-5 animate-spin" />
          <span>Processing your file...</span>
        </div>
      )}

      {/* CSV Format Guide */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-4">📋 CSV Format Guide</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">Reviews CSV Columns:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <code className="bg-white px-1">product_id</code> (required)</li>
              <li>• <code className="bg-white px-1">review_text</code> (required)</li>
              <li>• <code className="bg-white px-1">rating</code> (1-5, required)</li>
              <li>• <code className="bg-white px-1">date</code> (YYYY-MM-DD)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">Sales CSV Columns:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <code className="bg-white px-1">product_id</code> (required)</li>
              <li>• <code className="bg-white px-1">product_name</code> (required)</li>
              <li>• <code className="bg-white px-1">category</code> (required)</li>
              <li>• <code className="bg-white px-1">sales</code> (number)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Error500Page() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-200 dark:text-gray-800">500</h1>
        <p className="text-xl font-semibold text-gray-900 dark:text-white mt-4">Internal Server Error</p>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Something went wrong on our end. Please try again later.</p>
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

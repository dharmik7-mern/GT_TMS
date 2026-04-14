import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound404() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-200 dark:text-gray-800">404</h1>
        <p className="text-xl font-semibold text-gray-900 dark:text-white mt-4">Page not found</p>
        <p className="text-gray-500 dark:text-gray-400 mt-2">The page you're looking for doesn't exist.</p>
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}

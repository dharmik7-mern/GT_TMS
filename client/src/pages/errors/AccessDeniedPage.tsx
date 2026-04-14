import React from 'react';
import { Link } from 'react-router-dom';

const AccessDeniedPage: React.FC = () => {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/80 p-8">
        <h1 className="text-2xl font-semibold">Access Denied</h1>
        <p className="mt-3 text-slate-300">
          Your role does not have permission to access this section.
        </p>
        <Link className="inline-flex mt-6 rounded-lg bg-sky-500 px-4 py-2 text-white" to="/dashboard">
          Back To Dashboard
        </Link>
      </section>
    </main>
  );
};

export default AccessDeniedPage;

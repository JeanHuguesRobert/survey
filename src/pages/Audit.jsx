import React from 'react';
import { Link } from 'react-router-dom';
import AuditContent from '../components/AuditContent';

export default function Audit() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <div className="mb-4">
              <div className="text-5xl font-bold" style={{ color: '#FF5722' }}>
                #PERTITELLU
              </div>
              <div className="h-1 bg-blue-900 my-3 max-w-2xl mx-auto"></div>
              <div className="text-4xl font-bold text-blue-900">
                CORTI<br/>CAPITALE
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <AuditContent />
          
          <div className="mt-8 text-center">
            <Link to="/" className="px-4 py-2 bg-gray-100 text-blue-900 font-semibold rounded-md hover:bg-gray-200">
              Retour à la consultation
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

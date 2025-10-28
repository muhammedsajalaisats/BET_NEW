import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Plane } from 'lucide-react';

export default function UserControl() {
  const [isOn, setIsOn] = useState(false);
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-fuchsia-50 to-slate-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-lg flex items-center justify-center shadow-md">
                <Plane className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">BET Tracker</h1>
                <p className="text-xs text-gray-500">Air India SATS</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
                <p className="text-xs text-gray-500 capitalize">{profile?.role?.replace('_', ' ')}</p>
              </div>
              <button
                onClick={() => signOut()}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">User Control Panel</h2>
            
            <div className="flex items-center justify-between bg-gray-100 p-4 rounded-lg">
              <span className="text-gray-700 font-medium">System Status</span>
              
              <button
                onClick={() => setIsOn(!isOn)}
                className={`
                  relative inline-flex h-10 w-20 items-center rounded-full transition-colors duration-300
                  ${isOn ? 'bg-purple-600' : 'bg-gray-300'}
                `}
              >
                <span
                  className={`
                    inline-block h-8 w-8 transform rounded-full bg-white transition-transform duration-300
                    ${isOn ? 'translate-x-11' : 'translate-x-1'}
                  `}
                />
                <span className="sr-only">{isOn ? 'On' : 'Off'}</span>
              </button>
            </div>
            
            <div className="mt-4 text-center">
              <p className="text-gray-600">
                Current Status: <span className="font-semibold">{isOn ? 'ON' : 'OFF'}</span>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
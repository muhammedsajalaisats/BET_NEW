import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plane, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const { signIn, resendConfirmationEmail, canResendEmail, getResendTimeRemaining } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-fuchsia-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
              <Plane className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">BET Tracker</h1>
            <p className="text-sm text-gray-500 mt-1">Air India SATS</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className={`border rounded-lg p-3 ${
                error.includes('confirmation email') 
                  ? 'bg-yellow-50 border-yellow-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start gap-2">
                  <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    error.includes('confirmation email') 
                      ? 'text-yellow-600' 
                      : 'text-red-600'
                  }`} />
                  <div className="flex-1">
                    <p className={`text-sm ${
                      error.includes('confirmation email') 
                        ? 'text-yellow-700' 
                        : 'text-red-700'
                    }`}>{error}</p>
                    
                    {error.includes('confirmation email') && (
                      <button
                        onClick={async () => {
                          try {
                            setResendLoading(true);
                            const message = await resendConfirmationEmail(email);
                            setError(message);
                          } catch (err: any) {
                            setError(err.message);
                          } finally {
                            setResendLoading(false);
                          }
                        }}
                        disabled={!canResendEmail() || resendLoading}
                        className={`
                          mt-2 text-sm px-3 py-1 rounded
                          ${!canResendEmail() 
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          }
                        `}
                      >
                        {resendLoading 
                          ? 'Sending...' 
                          : !canResendEmail()
                            ? `Wait ${getResendTimeRemaining()}s to resend`
                            : 'Resend confirmation email'
                        }
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
                placeholder="your.email@aisats.in"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white py-2.5 rounded-lg font-medium hover:from-purple-600 hover:to-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-center text-gray-500">
              BET Tracking System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

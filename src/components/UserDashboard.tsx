import { useState, useEffect } from 'react';
import { LogOut, Plane, Power, StopCircle, AlertCircle, RefreshCw, Battery } from 'lucide-react';
import { supabase, BETRecord, ChargingLog, UserProfile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import queryString from 'query-string';

interface Equipment extends BETRecord {
  id: string;
}

interface SwappingLog {
  id: number;
  created_at: string;
  User_id: string;
  location_id: string;
  equipment_id: string;
  Count: string;
}

interface ChargingPoint {
  id: string;
  Charging_Points_Name: string;
  Locations: string;
}

export default function UserDashboard() {
  const { profile, signOut } = useAuth();
  const [selectedEquipment, setSelectedEquipment] = useState<BETRecord | null>(null);
  const [currentSession, setCurrentSession] = useState<ChargingLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [logs, setLogs] = useState<ChargingLog[]>([]);
  const [totalSwapCount, setTotalSwapCount] = useState<number>(0);
  const [operationLoading, setOperationLoading] = useState(false);
  const [swappingLoading, setSwappingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swappingSuccess, setSwappingSuccess] = useState<string | null>(null);
  const [showChargingConfirm, setShowChargingConfirm] = useState(false);
  const [showSwapConfirm, setShowSwapConfirm] = useState(false);
  const [showStopChargingConfirm, setShowStopChargingConfirm] = useState(false);
  const [chargingPoints, setChargingPoints] = useState<ChargingPoint[]>([]);
  const [selectedChargingPoint, setSelectedChargingPoint] = useState<string>('');
  const [chargingPointsLoading, setChargingPointsLoading] = useState(false);
  const [meterReading, setMeterReading] = useState<string>('');
  const [swapMeterReading, setSwapMeterReading] = useState<string>('');

  // Function to validate and handle numeric input
  const handleNumericInput = (value: string): string => {
    // Remove all non-numeric characters except decimal point
    const numericValue = value.replace(/[^\d.]/g, '');
    
    // Ensure only one decimal point
    const parts = numericValue.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    
    return numericValue;
  };

  // Function to validate if input contains only numbers and optional decimal
  const isValidNumericInput = (value: string): boolean => {
    // Allow empty string, numbers, and numbers with decimal point
    if (value === '') return true;
    return /^\d*\.?\d*$/.test(value);
  };

  // Parse query parameters and handle equipment selection
  useEffect(() => {
    const params = queryString.parse(window.location.search);
    const equipmentNo = params.EquipmentNo as string;
    
    fetchEquipment(equipmentNo);
  }, [window.location.search]);

  // Fetch equipment current session and logs when equipment changes
  useEffect(() => {
    if (selectedEquipment) {
      fetchCurrentSession();
      fetchLogs();
      fetchTotalSwapCount();

      // Subscribe to charging log changes for this equipment
      const chargingChannel = supabase
        .channel(`charging_logs_${selectedEquipment.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'charging_logs',
            filter: `equipment_id=eq.${selectedEquipment.id}`,
          },
          () => {
            fetchCurrentSession();
            fetchLogs();
          }
        )
        .subscribe();

      // Subscribe to swapping log changes for this equipment
      const swappingChannel = supabase
        .channel(`swapping_logs_${selectedEquipment.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'swapping_log',
            filter: `equipment_id=eq.${selectedEquipment.id}`,
          },
          () => {
            fetchTotalSwapCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(chargingChannel);
        supabase.removeChannel(swappingChannel);
      };
    }
  }, [selectedEquipment?.id]);

  const fetchAllEquipment = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('bet_records')
        .select('*')
        .eq('location_id', profile?.location_id);

      if (fetchError) throw fetchError;
      setEquipment(data || []);
    } catch (error) {
      console.error('Error fetching all equipment:', error);
      setError('Failed to fetch equipment list');
    }
  };

  useEffect(() => {
    if (profile?.location_id) {
      fetchAllEquipment();
    }
  }, [profile?.location_id]);

  // Fetch charging points based on user location
  const fetchChargingPoints = async () => {
    if (!profile?.location_id) {
      console.log('No location_id available');
      return;
    }
    
    setChargingPointsLoading(true);
    
    try {
      console.log('Fetching charging points for location:', profile.location_id);
      
      const { data, error: fetchError } = await supabase
        .from('Charging_Points')
        .select('id, Charging_Points_Name, Locations')
        .eq('Locations', profile.location_id)
        .order('Charging_Points_Name', { ascending: true });

      if (fetchError) {
        console.error('Supabase error:', fetchError);
        throw fetchError;
      }
      
      console.log('Charging points fetched:', data);
      setChargingPoints(data || []);
      
      // Clear any previous error if successful
      if (data) {
        setError(null);
      }
    } catch (error: any) {
      console.error('Error fetching charging points:', error);
      
      // Show meaningful error message
      if (error.code === '42P01') {
        console.error('Charging_Points table does not exist');
      } else if (error.code === '42703') {
        console.error('Column Locations or Charging_Points_Name does not exist in Charging_Points table');
      } else {
        console.error('Failed to load charging points:', error.message);
      }
      
      setChargingPoints([]);
    } finally {
      setChargingPointsLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.location_id) {
      fetchChargingPoints();
    }
  }, [profile?.location_id]);

  const fetchEquipment = async (equipmentNo?: string) => {
    if (!equipmentNo) {
      setQueryError('Equipment number is required');
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('bet_records')
        .select('*')
        .eq('location_id', profile?.location_id)
        .eq('status', 'operational')
        .eq('equipment_id', equipmentNo)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setQueryError(`Equipment ${equipmentNo} not found or not accessible`);
        setSelectedEquipment(null);
      } else {
        setSelectedEquipment(data);
        setQueryError(null);
      }
    } catch (error) {
      console.error('Error fetching equipment:', error);
      setQueryError('Failed to fetch equipment');
      setSelectedEquipment(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSession = async () => {
    if (!selectedEquipment) return;
    
    try {
      // Get the most recent session for this equipment where end_time is NULL
      const { data, error } = await supabase
        .from('charging_logs')
        .select('*')
        .eq('equipment_id', selectedEquipment.id)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCurrentSession(data || null);
    } catch (error) {
      console.error('Error fetching current session:', error);
      setCurrentSession(null);
    }
  };

  const fetchLogs = async () => {
    if (!selectedEquipment) return;
    try {
      const { data, error } = await supabase
        .from('charging_logs')
        .select('*')
        .eq('equipment_id', selectedEquipment.id)
        .order('start_time', { ascending: false })
        .limit(5);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const fetchTotalSwapCount = async () => {
    if (!selectedEquipment) return;
    try {
      const { data, error, count } = await supabase
        .from('swapping_log')
        .select('*', { count: 'exact', head: true })
        .eq('equipment_id', selectedEquipment.id);

      if (error) throw error;
      setTotalSwapCount(count || 0);
    } catch (error) {
      console.error('Error fetching total swap count:', error);
      setTotalSwapCount(0);
    }
  };

  const startCharging = async () => {
    if (!selectedEquipment || !profile) {
      setError('No equipment selected or user not authenticated');
      return;
    }

    // Check if user has charging access
    if (!profile.Charging_Access) {
      setError('You do not have permission to start charging');
      return;
    }

    // Validate charging point selection - MANDATORY
    if (!selectedChargingPoint) {
      setError('Please select a charging point before starting');
      return;
    }

    // Validate meter reading - MANDATORY
    if (!meterReading || meterReading.trim() === '') {
      setError('Please enter a meter reading before starting');
      return;
    }

    // Validate that meter reading is a valid number
    if (!isValidNumericInput(meterReading)) {
      setError('Meter reading must be a valid number');
      return;
    }

    // Check if equipment already has an active session (safety check)
    await fetchCurrentSession();
    if (currentSession) {
      setError('Equipment is already charging');
      return;
    }

    setOperationLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('charging_logs')
        .insert([{
          equipment_id: selectedEquipment.id,
          user_id: profile.id,
          location_id: selectedEquipment.location_id,
          start_time: new Date().toISOString(),
          charging_point_id: selectedChargingPoint,
          Meter_reading: meterReading,
        }])
        .select()
        .single();

      if (error) throw error;

      // Update local state immediately
      setCurrentSession(data);
      
    } catch (err: any) {
      console.error('Error starting charging:', err);
      setError(err.message || 'Failed to start charging');
    } finally {
      setOperationLoading(false);
    }
  };

  const stopCharging = async () => {
    if (!currentSession || !profile) {
      setError('No active charging session or user not authenticated');
      return;
    }

    // Check if user has charging access
    if (!profile.Charging_Access) {
      setError('You do not have permission to stop charging');
      return;
    }

    setOperationLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('charging_logs')
        .update({
          end_time: new Date().toISOString(),
        })
        .eq('id', currentSession.id);

      if (error) throw error;

      // Update local state immediately
      setCurrentSession(null);
      
    } catch (err: any) {
      console.error('Error stopping charging:', err);
      setError(err.message || 'Failed to stop charging');
    } finally {
      setOperationLoading(false);
    }
  };

  const recordBatterySwap = async () => {
    if (!selectedEquipment || !profile) {
      setError('No equipment selected or user not authenticated');
      return;
    }

    // Check if user has swapping access
    if (!profile.Swapping_Access) {
      setError('You do not have permission to record battery swaps');
      return;
    }

    // Validate meter reading - MANDATORY
    if (!swapMeterReading || swapMeterReading.trim() === '') {
      setError('Please enter a meter reading before recording swap');
      return;
    }

    // Validate that meter reading is a valid number
    if (!isValidNumericInput(swapMeterReading)) {
      setError('Meter reading must be a valid number');
      return;
    }

    setSwappingLoading(true);
    setError('');
    setSwappingSuccess(null);

    try {
      // Insert new swapping log with count = 1 and meter reading
      const { error: insertError } = await supabase
        .from('swapping_log')
        .insert([{
          User_id: profile.id,
          location_id: selectedEquipment.location_id,
          equipment_id: selectedEquipment.id,
          Count: '1',
          Meter_reading: swapMeterReading,
        }]);

      if (insertError) throw insertError;

      setSwappingSuccess('Battery swap recorded successfully!');
      
      // Clear the meter reading input after successful swap
      setSwapMeterReading('');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSwappingSuccess(null);
      }, 3000);

      // Refresh total count
      fetchTotalSwapCount();
      
    } catch (err: any) {
      console.error('Error recording battery swap:', err);
      setError(err.message || 'Failed to record battery swap');
    } finally {
      setSwappingLoading(false);
    }
  };

  const handleStartChargingClick = () => {
    // Charging point selection is MANDATORY
    if (!selectedChargingPoint) {
      setError('Please select a charging point before starting');
      return;
    }

    // Meter reading is MANDATORY
    if (!meterReading || meterReading.trim() === '') {
      setError('Please enter a meter reading before starting');
      return;
    }

    // Validate that meter reading is a valid number
    if (!isValidNumericInput(meterReading)) {
      setError('Meter reading must be a valid number');
      return;
    }

    setShowChargingConfirm(true);
  };

  const handleStopChargingClick = () => {
    setShowStopChargingConfirm(true);
  };

  const handleRecordSwapClick = () => {
    // Validate meter reading before showing confirmation
    if (!swapMeterReading || swapMeterReading.trim() === '') {
      setError('Please enter a meter reading before recording swap');
      return;
    }

    // Validate that meter reading is a valid number
    if (!isValidNumericInput(swapMeterReading)) {
      setError('Meter reading must be a valid number');
      return;
    }

    setShowSwapConfirm(true);
  };

  const confirmStartCharging = () => {
    setShowChargingConfirm(false);
    startCharging();
  };

  const confirmStopCharging = () => {
    setShowStopChargingConfirm(false);
    stopCharging();
  };

  const confirmRecordSwap = () => {
    setShowSwapConfirm(false);
    recordBatterySwap();
  };

  // Determine button state based on equipment's current session
  const isEquipmentCharging = currentSession !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-sky-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
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
                <div className="flex gap-2 mt-1">
                  {profile?.Charging_Access && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Charging</span>
                  )}
                  {profile?.Swapping_Access && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Swapping</span>
                  )}
                </div>
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
        <div className="max-w-3xl mx-auto">
          {queryError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-700">{queryError}</p>
              </div>
            </div>
          )}
          
          {!queryString.parse(window.location.search).EquipmentNo && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Equipment
              </label>
              <select
                value={selectedEquipment?.id || ''}
                onChange={(e) => {
                  const selected = equipment.find(eq => eq.id === e.target.value);
                  setSelectedEquipment(selected || null);
                  setCurrentSession(null); // Reset session when equipment changes
                  setSelectedChargingPoint(''); // Reset charging point when equipment changes
                  setMeterReading(''); // Reset meter reading when equipment changes
                  setSwapMeterReading(''); // Reset swap meter reading when equipment changes
                  
                  // Update URL with equipment number
                  if (selected) {
                    const newUrl = queryString.stringifyUrl({
                      url: window.location.pathname,
                      query: { EquipmentNo: selected.equipment_id }
                    });
                    window.history.pushState({}, '', newUrl);
                  }
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Select Equipment</option>
                {equipment.map(eq => (
                  <option key={eq.id} value={eq.id}>
                    {eq.equipment_id} - {eq.equipment_type}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedEquipment && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedEquipment.equipment_id}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedEquipment.equipment_type}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Status: {selectedEquipment.status}
                  </p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {swappingSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-green-700">{swappingSuccess}</p>
                </div>
              )}

              {/* Charging Point Selection - Only show when not currently charging */}
              {!isEquipmentCharging && profile?.Charging_Access && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Charging Point <span className="text-red-500">*</span>
                    </label>
                    {chargingPointsLoading ? (
                      <div className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm">
                        Loading charging points...
                      </div>
                    ) : chargingPoints.length > 0 ? (
                      <select
                        value={selectedChargingPoint}
                        onChange={(e) => {
                          setSelectedChargingPoint(e.target.value);
                          setError(''); // Clear any previous errors
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        required
                      >
                        <option value="">Select a charging point</option>
                        {chargingPoints.map(point => (
                          <option key={point.id} value={point.id}>
                            {point.Charging_Points_Name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-full px-4 py-2.5 border border-amber-200 rounded-lg bg-amber-50 text-sm">
                        <p className="text-amber-700 font-medium">
                          No charging points configured for your location.
                        </p>
                        <p className="text-amber-600 text-xs mt-1">
                          Please contact your administrator to set up charging points.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meter Reading <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={meterReading}
                      onChange={(e) => {
                        const numericValue = handleNumericInput(e.target.value);
                        setMeterReading(numericValue);
                        setError(''); // Clear any previous errors
                      }}
                      placeholder="Enter meter reading"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      required
                      inputMode="decimal"
                      pattern="[0-9]*\.?[0-9]*"
                      title="Please enter numbers only"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter numbers only (e.g., 1234 or 1234.5)
                    </p>
                  </div>
                </>
              )}

              {/* Charging Control Buttons */}
              <div className="flex items-center gap-3 mb-6">
                {isEquipmentCharging ? (
                  <button
                    onClick={handleStopChargingClick}
                    disabled={operationLoading || !profile?.Charging_Access}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  >
                    <StopCircle className="w-5 h-5" />
                    {operationLoading ? 'Stopping...' : 'Stop Charging'}
                  </button>
                ) : (
                  <button
                    onClick={handleStartChargingClick}
                    disabled={operationLoading || !profile?.Charging_Access || !selectedChargingPoint || !meterReading}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  >
                    <Power className="w-5 h-5" />
                    {operationLoading ? 'Starting...' : 'Start Charging'}
                  </button>
                )}
              </div>

              {currentSession && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">Currently Charging</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Started: {new Date(currentSession.start_time).toLocaleString()}
                      </p>
                      {currentSession.user_id && (
                        <p className="text-xs text-blue-600 mt-1">
                          Started by: {currentSession.user_id === profile?.id ? 'You' : 'Another user'}
                        </p>
                      )}
                    </div>
                    <div className="animate-pulse">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Battery Swapping Section */}
              {profile?.Swapping_Access && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <div className="mb-4">
                    <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2 mb-3">
                      <Battery className="w-5 h-5 text-amber-600" />
                      Battery Swapping
                    </h4>
                    <p className="text-xs text-gray-500 mb-4">
                      Total swaps: {totalSwapCount}
                    </p>

                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meter Reading <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={swapMeterReading}
                      onChange={(e) => {
                        const numericValue = handleNumericInput(e.target.value);
                        setSwapMeterReading(numericValue);
                        setError(''); // Clear any previous errors
                      }}
                      placeholder="Enter meter reading"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white mb-4"
                      required
                      inputMode="decimal"
                      pattern="[0-9]*\.?[0-9]*"
                      title="Please enter numbers only"
                    />
                    <p className="text-xs text-gray-500 mb-4">
                      Enter numbers only (e.g., 1234 or 1234.5)
                    </p>
                  </div>

                  <button
                    onClick={handleRecordSwapClick}
                    disabled={swappingLoading || !profile?.Swapping_Access || !swapMeterReading}
                    className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  >
                    <RefreshCw className={`w-5 h-5 ${swappingLoading ? 'animate-spin' : ''}`} />
                    {swappingLoading ? 'Recording...' : 'Record Swap'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Charging Confirmation Modal */}
      {showChargingConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Power className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Confirm Start Charging</h3>
            </div>
            <p className="text-gray-600 mb-2">
              Are you sure you want to start charging for equipment <strong>{selectedEquipment?.equipment_id}</strong>?
            </p>
            {selectedChargingPoint && (
              <p className="text-sm text-gray-500 mb-2">
                Charging Point: <strong>{chargingPoints.find(p => p.id === selectedChargingPoint)?.Charging_Points_Name}</strong>
              </p>
            )}
            {meterReading && (
              <p className="text-sm text-gray-500 mb-6">
                Meter Reading: <strong>{meterReading}</strong>
              </p>
            )}
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowChargingConfirm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmStartCharging}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Battery Swap Confirmation Modal */}
      {showSwapConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <Battery className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Confirm Battery Swap</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to record a battery swap for equipment <strong>{selectedEquipment?.equipment_id}</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSwapConfirm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRecordSwap}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stop Charging Confirmation Modal */}
      {showStopChargingConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <StopCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Confirm Stop Charging</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to stop charging for equipment <strong>{selectedEquipment?.equipment_id}</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowStopChargingConfirm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmStopCharging}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
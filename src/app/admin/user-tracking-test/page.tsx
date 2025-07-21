'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { ArrowPathIcon, UsersIcon, ChartBarIcon, CurrencyDollarIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

interface UserActivityStat {
  user_id: string
  email: string
  full_name: string
  company: string
  total_sessions: number
  total_findings: number
  total_cost: number
  total_tokens: number
  last_activity: string
  is_current_user: boolean
}

interface ResearchSession {
  id: string
  created_by: string
  session_type: string
  status: string
  total_cost?: number
  total_tokens?: number
  cost_usd?: number
  tokens_used?: number
  created_at: string
  user_profiles?: {
    clerk_user_id: string
    email: string
    full_name: string
  } | null
}

interface UserTrackingData {
  current_user_id: string
  total_users: number
  user_activity_stats?: UserActivityStat[]
  recent_sessions?: ResearchSession[]
  user_separation_test?: {
    users_have_unique_ids: boolean
    sessions_properly_attributed: boolean
    findings_properly_attributed: boolean
  }
  test_status?: string
  sessions_error?: string
  findings_error?: string
}

export default function UserTrackingTestPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const [data, setData] = useState<UserTrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/admin/user-tracking-test')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchData()
    }
  }, [isLoaded, isSignedIn])

  if (!isLoaded || !isSignedIn) {
    return <div className="p-8">Please sign in to view this page.</div>
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" />
        Loading user tracking data...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-slate-800/50 backdrop-blur-xl border border-red-500/50 rounded-xl p-6">
          <h2 className="text-red-400 text-lg font-semibold mb-4">Error</h2>
          <p className="text-slate-300 mb-4">{error}</p>
          <button 
            onClick={fetchData}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="p-8">No data available</div>
  }

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const formatDate = (dateString: string) => 
    new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">User Tracking Test Dashboard</h1>
            <p className="text-slate-400 mt-2">
              Testing individual user identification and activity tracking
            </p>
          </div>
          <button 
            onClick={fetchData}
            className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white rounded-lg transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>

        {/* Current User Info */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <UsersIcon className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Current User Identification</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-400">Your User ID</p>
              <p className="font-mono text-sm bg-slate-900 text-green-400 p-2 rounded mt-1">{data.current_user_id}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Users in System</p>
              <p className="text-2xl font-bold text-white mt-1">{data.total_users}</p>
            </div>
          </div>
        </div>

        {/* User Separation Test Results */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">User Separation Test Results</h2>
          <p className="text-slate-400 text-sm mb-4">
            Verification that users are properly identified and separated
          </p>
          
          {/* Test Status */}
          <div className="mb-4">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              data.test_status === 'full_success' 
                ? "bg-green-900/30 text-green-300" 
                : data.test_status === 'partial_success'
                ? "bg-yellow-900/30 text-yellow-300"
                : "bg-red-900/30 text-red-300"
            }`}>
              {data.test_status || 'unknown'}
            </span>
          </div>

          {data.user_separation_test ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Users have unique IDs</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  data.user_separation_test.users_have_unique_ids 
                    ? "bg-green-900/30 text-green-300" 
                    : "bg-red-900/30 text-red-300"
                }`}>
                  {data.user_separation_test.users_have_unique_ids ? "✓ PASS" : "✗ FAIL"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Sessions properly attributed to users</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  data.user_separation_test.sessions_properly_attributed 
                    ? "bg-green-900/30 text-green-300" 
                    : "bg-red-900/30 text-red-300"
                }`}>
                  {data.user_separation_test.sessions_properly_attributed ? "✓ PASS" : "✗ FAIL"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Findings properly attributed to users</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  data.user_separation_test.findings_properly_attributed 
                    ? "bg-green-900/30 text-green-300" 
                    : "bg-red-900/30 text-red-300"
                }`}>
                  {data.user_separation_test.findings_properly_attributed ? "✓ PASS" : "✗ FAIL"}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-slate-400">
              <p>Test data not available</p>
              {data.sessions_error && <p className="text-red-400 text-xs">Sessions error: {data.sessions_error}</p>}
              {data.findings_error && <p className="text-red-400 text-xs">Findings error: {data.findings_error}</p>}
            </div>
          )}
        </div>

        {/* User Activity Stats */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <ChartBarIcon className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Individual User Activity</h2>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            Activity breakdown per user showing individual tracking
          </p>
          <div className="space-y-4">
            {data.user_activity_stats && data.user_activity_stats.length > 0 ? (
              data.user_activity_stats.map((user) => (
                <div 
                  key={user.user_id} 
                  className={`p-4 border rounded-lg ${user.is_current_user ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-900/50 border-slate-600/50'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{user.full_name}</h3>
                      <p className="text-sm text-slate-400">{user.email}</p>
                      <p className="text-xs text-slate-500">{user.company}</p>
                    </div>
                    {user.is_current_user && (
                      <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-medium">You</span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <ChartBarIcon className="h-4 w-4 text-blue-400" />
                      <span className="text-slate-300">{user.total_sessions} sessions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DocumentTextIcon className="h-4 w-4 text-green-400" />
                      <span className="text-slate-300">{user.total_findings} findings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CurrencyDollarIcon className="h-4 w-4 text-yellow-400" />
                      <span className="text-slate-300">{formatCurrency(user.total_cost)}</span>
                    </div>
                    <div className="text-slate-400">
                      Last: {formatDate(user.last_activity)}
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-slate-500 font-mono">
                    ID: {user.user_id.substring(0, 12)}...
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-400 text-center py-8">
                <p>No user activity data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Recent Research Sessions</h2>
          <p className="text-slate-400 text-sm mb-4">
            Latest research sessions showing user attribution
          </p>
          <div className="space-y-3">
            {data.recent_sessions && data.recent_sessions.length > 0 ? (
              data.recent_sessions.slice(0, 5).map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 border border-slate-600/50 rounded-lg bg-slate-900/30">
                  <div>
                    <p className="font-medium text-white">{session.session_type}</p>
                    <p className="text-sm text-slate-400">
                      by {session.user_profiles?.full_name || 'Unknown'} ({session.user_profiles?.email || 'Unknown'})
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(session.created_at)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      session.status === 'completed' 
                        ? 'bg-green-900/30 text-green-300' 
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {session.status}
                    </span>
                    <p className="text-slate-300 mt-1">
                      {formatCurrency(session.cost_usd || session.total_cost || 0)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(session.tokens_used || session.total_tokens || 0).toLocaleString()} tokens
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-400 text-center py-8">
                <p>No recent sessions available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
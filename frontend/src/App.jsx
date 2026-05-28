import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  CartesianGrid
} from 'recharts'
import { motion } from 'framer-motion'
import {
  Leaf,
  Globe,
  AlertTriangle,
  ShieldCheck,
  LayoutDashboard,
  ClipboardList,
  FileText,
  Trees,
  Factory,
  Wind,
  Database,
  Plane,
  Building2
} from 'lucide-react'
import './App.css'

function AnimatedNumber({ value, decimals = 0 }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef(null)

  useEffect(() => {
    const start = performance.now()
    const duration = 1000
    const from = display
    const to = value

    const tick = (now) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      const current = from + (to - from) * eased

      setDisplay(current)

      if (progress < 1) {
        raf.current = requestAnimationFrame(tick)
      }
    }

    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [value])

  return <>{decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}</>
}

export default function App() {
  const [filter, setFilter] = useState('All')
  const [activeTab, setActiveTab] = useState('Overview')
  const [rows, setRows] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)


  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
  const CLIENT_CODE = 'ENT_A'

  const COLORS = ['#47d286', '#7ff2b3', '#8ed8ff', '#d9ffe8']

  const scopeLabels = {
    'Scope 1': 'Direct operations',
    'Scope 2': 'Purchased energy',
    'Scope 3': 'Value chain'
  }

  const getScopeLabel = (scope) => {
    if (!scope) return 'Unassigned'
    return scopeLabels[scope] || scope
  }

  const formatActionType = (actionType) => {
    if (!actionType) return 'AUDIT EVENT'
    return actionType.replace(/_/g, ' ').toUpperCase()
  }

  const fetchRecords = () => {
    fetch(`${API_BASE}/api/records/?client_code=${CLIENT_CODE}`)
      .then((res) => res.json())
      .then((data) => {
        const formattedData = data.map((record) => ({
          id: record.id,
          clientName: record.client_name || 'Unknown Client',
          clientCode: record.client_code || 'N/A',
          source: record.source_type,
          scope: record.scope_category || 'Unassigned',
          quantity:
            record.normalized_value !== null && record.normalized_value !== undefined
              ? `${record.normalized_value.toLocaleString()} ${record.normalized_unit}`
              : '—',
          carbon:
            record.calculated_co2e_kg !== null && record.calculated_co2e_kg !== undefined
              ? `${record.calculated_co2e_kg.toLocaleString()} kg CO₂e`
              : '—',
          carbonValue: record.calculated_co2e_kg || 0,
          status: record.status.charAt(0) + record.status.slice(1).toLowerCase(),
          note: record.review_notes || 'System integrity check passed'
        }))
        setRows(formattedData)
      })
      .catch((err) => console.error('Error fetching data:', err))
  }

  const fetchAuditLogs = () => {
    fetch(`${API_BASE}/api/audit-logs/?client_code=${CLIENT_CODE}`)
      .then((res) => res.json())
      .then((data) => {
        const formattedLogs = data.map((log) => ({
          id: log.id,
          recordId: log.record,
          actionType: log.action_type,
          performedBy: log.performed_by,
          previousState: log.previous_state,
          newState: log.new_state,
          timestamp: log.timestamp
        }))
        setAuditLogs(formattedLogs)
      })
      .catch((err) => console.error('Error fetching audit logs:', err))
  }

  useEffect(() => {
    fetchRecords()
    fetchAuditLogs()

    const fadeTimer = setTimeout(() => {
      setFadeOut(true)
    }, 2800)

    const removeTimer = setTimeout(() => {
      setLoading(false)
    }, 4200)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [])

  const handleApprove = (id) => {
    fetch(`${API_BASE}/api/records/${id}/approve/`, { method: 'POST' }).then(() => {
      fetchRecords()
      fetchAuditLogs()
    })
  }

  const handleReject = (id) => {
    fetch(`${API_BASE}/api/records/${id}/reject/`, { method: 'POST' }).then(() => {
      fetchRecords()
      fetchAuditLogs()
    })
  }

  const filteredRows = rows.filter(
    (row) => filter === 'All' || row.status.toLowerCase() === filter.toLowerCase()
  )

  const totalRecords = rows.length
  const pendingRecords = rows.filter((r) => r.status.toLowerCase() === 'pending').length
  const failedRecords = rows.filter((r) => r.status.toLowerCase() === 'failed').length
  const suspiciousRecords = rows.filter((r) => r.status.toLowerCase() === 'suspicious').length
  const approvedRecords = rows.filter((r) => r.status.toLowerCase() === 'approved').length

  const totalCarbon = rows.reduce((sum, row) => sum + row.carbonValue, 0)
  const activeClientName = rows[0]?.clientName || 'Enterprise Client A'

  const scopeImpactData = useMemo(() => {
    const grouped = rows.reduce((acc, row) => {
      const label = getScopeLabel(row.scope)
      acc[label] = (acc[label] || 0) + row.carbonValue
      return acc
    }, {})

    return Object.entries(grouped).map(([type, amount]) => ({
      type,
      amount: Number(amount.toFixed(2))
    }))
  }, [rows])

  const sourceBreakdownData = useMemo(() => {
    const grouped = rows.reduce((acc, row) => {
      const key = row.source || 'Unknown'
      acc[key] = (acc[key] || 0) + row.carbonValue
      return acc
    }, {})

    return Object.entries(grouped).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2))
    }))
  }, [rows])

  const statusAnalyticsData = useMemo(() => {
    return [
      { month: 'Pending', carbon: pendingRecords },
      { month: 'Approved', carbon: approvedRecords },
      { month: 'Failed', carbon: failedRecords },
      { month: 'Suspicious', carbon: suspiciousRecords }
    ]
  }, [pendingRecords, approvedRecords, failedRecords, suspiciousRecords])

  if (loading) {
    return (
      <div className={`opening-screen ${fadeOut ? 'opening-fade' : ''}`}>
        <div className="opening-bg" />
        <div className="opening-glow glow-a" />
        <div className="opening-glow glow-b" />
        <div className="opening-glow glow-c" />

        <div className="particles">
          {[...Array(18)].map((_, i) => (
            <span
              key={i}
              className="particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 6}s`,
                animationDuration: `${7 + Math.random() * 6}s`
              }}
            />
          ))}
        </div>

        <div className="opening-content">
          <div className="opening-earth-wrap">
            <div className="opening-earth-glow" />
            <div className="opening-earth" />
            <div className="opening-ring ring-one" />
            <div className="opening-ring ring-two" />
            <div className="opening-ring ring-three" />
          </div>

          <div className="opening-text">
            <span className="opening-eyebrow">Environmental Reflection</span>
            <h1>The Earth is what we all have in common.</h1>
            <p>— Wendell Berry</p>
          </div>

          <div className="loading-line">
            <div className="loading-line-fill" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="bg-glow glow1" />
      <div className="bg-glow glow2" />
      <div className="bg-glow glow3" />

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Leaf size={26} strokeWidth={2.4} />
          </div>
          <div>
            <h2>
              Breathe<span>ESG</span>
            </h2>
            <p>Climate Intelligence</p>
          </div>
        </div>

        <nav className="nav">
          <button
            className={activeTab === 'Overview' ? 'active' : ''}
            onClick={() => setActiveTab('Overview')}
          >
            <LayoutDashboard size={18} />
            Overview
          </button>

          <button
            className={activeTab === 'Review Queue' ? 'active' : ''}
            onClick={() => setActiveTab('Review Queue')}
          >
            <ClipboardList size={18} />
            Review Queue
          </button>

          <button
            className={activeTab === 'Audit Logs' ? 'active' : ''}
            onClick={() => setActiveTab('Audit Logs')}
          >
            <FileText size={18} />
            Audit Logs
          </button>
        </nav>

        <div className="sidebar-card">
          <div className="sidebar-card-glow" />
          <h3>Every tonne counts 🌍</h3>
          <p>Track impact across records and keep sustainability review decisions visible.</p>
          <button onClick={() => setActiveTab('Overview')}>Explore Impact →</button>
        </div>
      </aside>

      <main className="main">
        <section className="hero">
          <div className="hero-gradient" />
          <div className="hero-content">
            <span className="eyebrow">CARBON ACCOUNTABILITY</span>
            <h1>Sustainability, made accountable.</h1>
            <p>See the full story behind every submission.</p>
            <div className="hero-buttons">
              <button className="primary-btn" onClick={() => setActiveTab('Review Queue')}>
                Open Dashboard
              </button>
              <button className="secondary-btn" onClick={() => setActiveTab('Audit Logs')}>
                View Reports
              </button>
            </div>
          </div>

          <div className="earth-area">
            <div className="earth-glow" />
            <div className="earth" />
            <div className="orbit orbit1" />
            <div className="orbit orbit2" />
            <div className="spark spark1" />
            <div className="spark spark2" />
            <div className="spark spark3" />
          </div>
        </section>

        <section className="stats">
          <div className="stat-card">
            <div className="stat-glow" />
            <div className="stat-icon">
              <Leaf size={28} />
            </div>
            <div>
              <span>Total Records</span>
              <h2>
                <AnimatedNumber value={totalRecords} />
              </h2>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-glow" />
            <div className="stat-icon">
              <Globe size={28} />
            </div>
            <div>
              <span>Approved Logs</span>
              <h2>
                <AnimatedNumber value={approvedRecords} />
              </h2>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-glow" />
            <div className="stat-icon">
              <AlertTriangle size={28} />
            </div>
            <div>
              <span>Flagged Issues</span>
              <h2>
                <AnimatedNumber value={failedRecords + suspiciousRecords} />
              </h2>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-glow" />
            <div className="stat-icon">
              <ShieldCheck size={28} />
            </div>
            <div>
              <span>Awaiting Sign-Off</span>
              <h2>
                <AnimatedNumber value={pendingRecords} />
              </h2>
            </div>
          </div>
        </section>

        {activeTab === 'Overview' && (
          <section className="analytics-section">
            <div className="analytics-header">
              <div>
                <span className="analytics-eyebrow">Portfolio Overview</span>
                <h2>Verified ESG activity for {activeClientName}</h2>
              </div>
              <div className="analytics-chip">
                <Building2 size={16} />
                {CLIENT_CODE}
              </div>
            </div>

            <div className="analytics-grid">
              <motion.div
                className="chart-card large-card"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <div className="chart-glow" />
                <div className="card-top">
                  <div>
                    <span className="chart-label">Review Status</span>
                    <h3>Workflow Distribution</h3>
                  </div>
                  <div className="mini-badge">
                    <Wind size={15} />
                    {totalRecords} records
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={statusAnalyticsData}>
                    <defs>
                      <linearGradient id="greenGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#47d286" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#47d286" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="carbon"
                      stroke="#47d286"
                      strokeWidth={4}
                      fill="url(#greenGlow)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div
                className="chart-card"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
              >
                <div className="chart-glow small-glow" />
                <div className="card-top">
                  <div>
                    <span className="chart-label">Source Systems</span>
                    <h3>Emission Sources</h3>
                  </div>
                  <Factory size={20} />
                </div>

                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={sourceBreakdownData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={6}
                    >
                      {sourceBreakdownData.map((entry, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div
                className="chart-card"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
              >
                <div className="chart-glow blue-glow" />
                <div className="card-top">
                  <div>
                    <span className="chart-label">Scope Summary</span>
                    <h3>Scope-wise Emissions</h3>
                  </div>
                  <Trees size={20} />
                </div>

                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={scopeImpactData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
                    <XAxis dataKey="type" axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="amount" radius={[12, 12, 0, 0]} fill="#7ff2b3" />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div
                className="insight-card"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
              >
                <div className="insight-glow" />
                <div className="insight-top">
                  <Leaf size={24} />
                  <span>Portfolio Insight</span>
                </div>
                <h3>
                  Total tracked footprint: <AnimatedNumber value={totalCarbon} decimals={2} /> kg CO₂e
                </h3>
                <p>
                  These metrics are generated from ingested source records for {activeClientName},
                  grouped by review status, source system, and emissions scope.
                </p>
                <button onClick={() => setActiveTab('Review Queue')}>Review Source Records</button>
              </motion.div>
            </div>
          </section>
        )}

        {activeTab === 'Review Queue' && (
          <section className="table-wrap">
            <div className="table-light" />
            <div className="table-orb orb-a" />
            <div className="table-orb orb-b" />

            <div className="table-header">
              <div>
                <h2>Review Queue Portfolio</h2>
                <p>{filteredRows.length} ledgers matching for {activeClientName}</p>
              </div>

              <div className="filters">
                {['All', 'Pending', 'Approved', 'Failed', 'Suspicious'].map((item) => (
                  <button
                    key={item}
                    className={filter === item ? 'filter-active' : ''}
                    onClick={() => setFilter(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Source Vector</th>
                    <th>Scope Category</th>
                    <th>Normalized Value</th>
                    <th>Calculated Impact</th>
                    <th>Validation Status</th>
                    <th>System Notes</th>
                    <th>Review Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-row">
                        <span>No ledger entries found tracking this filter.</span>
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.id}>
                        <td className="source">
                          {row.source === 'SAP' ? (
                            <Database
                              size={14}
                              className="inline-table-icon"
                              style={{ marginRight: '6px' }}
                            />
                          ) : row.source === 'TRAVEL' ? (
                            <Plane
                              size={14}
                              className="inline-table-icon"
                              style={{ marginRight: '6px' }}
                            />
                          ) : (
                            <Leaf
                              size={14}
                              className="inline-table-icon"
                              style={{ marginRight: '6px' }}
                            />
                          )}
                          {row.source}
                        </td>
                        <td>
                          <span className="scope-tag">{getScopeLabel(row.scope)}</span>
                        </td>
                        <td className="mono">{row.quantity}</td>
                        <td className="carbon">{row.carbon}</td>
                        <td>
                          <span className={`status ${row.status.toLowerCase()}`}>{row.status}</span>
                        </td>
                        <td
                          className={
                            row.status === 'Suspicious' || row.status === 'Failed'
                              ? 'danger-note'
                              : 'note'
                          }
                        >
                          {row.note}
                        </td>
                        <td>
                          {row.status === 'Approved' ? (
                            <span className="locked-label">Locked & Signed</span>
                          ) : (
                            <div className="actions">
                              <button className="approve" onClick={() => handleApprove(row.id)}>
                                Approve
                              </button>
                              <button className="reject" onClick={() => handleReject(row.id)}>
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'Audit Logs' && (
          <section className="table-wrap">
            <div className="table-header">
              <div>
                <h2>Audit Verification Ledger History</h2>
                <p>{auditLogs.length} audit event(s) recorded for {activeClientName}</p>
              </div>
            </div>

            <div className="audit-log-list">
              {auditLogs.length === 0 ? (
                <div className="empty-row" style={{ padding: '32px' }}>
                  <span>No audit events recorded yet.</span>
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="audit-log-card">
                    <div className="audit-log-top">
                      <div className="audit-log-heading">
                        <span className="audit-status-badge">{formatActionType(log.actionType)}</span>
                        <strong>Record #{log.recordId}</strong>
                      </div>
                      <span className="audit-time">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>

                    <div className="audit-log-body">
                      <p>
                        <span>Performed by:</span> {log.performedBy}
                      </p>
                      <p>
                        <span>Previous status:</span> {log.previousState?.status ?? '—'}
                      </p>
                      <p>
                        <span>New status:</span> {log.newState?.status ?? '—'}
                      </p>
                      {(log.previousState?.review_notes || log.newState?.review_notes) && (
                        <>
                          <p>
                            <span>Previous notes:</span> {log.previousState?.review_notes ?? '—'}
                          </p>
                          <p>
                            <span>New notes:</span> {log.newState?.review_notes ?? '—'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
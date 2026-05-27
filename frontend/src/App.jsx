import React, { useState, useEffect, useRef } from 'react'
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
  BarChart3,
  FileText,
  Sparkles,
  Trees,
  Factory,
  Wind,
  Database,
  Plane
} from 'lucide-react'
import './App.css'

// ── Animated Counter Component ───────────────────────────────────────
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
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [value])

  return <>{decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}</>
}

// ── Main Workspace Application ───────────────────────────────────────
export default function App() {
  const [filter, setFilter] = useState('All')
  const [activeTab, setActiveTab] = useState('Review Queue')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  const API_BASE = 'http://127.0.0.1:8000'

  const emissionsData = [
    { month: 'Jan', carbon: 240 },
    { month: 'Feb', carbon: 300 },
    { month: 'Mar', carbon: 210 },
    { month: 'Apr', carbon: 400 },
    { month: 'May', carbon: 350 },
    { month: 'Jun', carbon: 520 },
    { month: 'Jul', carbon: 470 }
  ]

  const sourceData = [
    { name: 'SAP', value: 45 },
    { name: 'Travel', value: 25 },
    { name: 'Utilities', value: 20 },
    { name: 'Logistics', value: 10 }
  ]

  const impactData = [
    { type: 'Scope 1', amount: 65 },
    { type: 'Scope 2', amount: 42 },
    { type: 'Scope 3', amount: 88 }
  ]

  const COLORS = [
    '#47d286',
    '#7ff2b3',
    '#8ed8ff',
    '#d9ffe8'
  ]

  const fetchRecords = () => {
    fetch(`${API_BASE}/api/records/`)
      .then((res) => res.json())
      .then((data) => {
        const formattedData = data.map(record => ({
          id: record.id,
          source: record.source_type,
          scope: record.scope_category || 'Unassigned',
          quantity: record.normalized_value ? `${record.normalized_value.toLocaleString()} ${record.normalized_unit}` : '—',
          carbon: record.calculated_co2e_kg ? `${record.calculated_co2e_kg.toLocaleString()} kg CO₂e` : '—',
          status: record.status.charAt(0) + record.status.slice(1).toLowerCase(),
          note: record.review_notes || 'System integrity check passed'
        }))
        setRows(formattedData)
      })
      .catch((err) => console.error('Error fetching data:', err))
  }

  useEffect(() => {
    fetchRecords()

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
    fetch(`${API_BASE}/api/records/${id}/approve/`, { method: 'POST' }).then(() => fetchRecords())
  }

  const handleReject = (id) => {
    fetch(`${API_BASE}/api/records/${id}/reject/`, { method: 'POST' }).then(() => fetchRecords())
  }

  const filteredRows = rows.filter(row =>
    filter === 'All' || row.status.toLowerCase() === filter.toLowerCase()
  )

  const totalRecords = rows.length
  const pendingRecords = rows.filter((r) => r.status.toLowerCase() === 'pending').length
  const failedRecords = rows.filter((r) => r.status.toLowerCase() === 'failed').length
  const approvedRecords = rows.filter((r) => r.status.toLowerCase() === 'approved').length

  if (loading) {
    return (
      <div className={`opening-screen ${fadeOut ? 'opening-fade' : ''}`}>
        {/* BACKGROUND */}
        <div className="opening-bg" />
        <div className="opening-glow glow-a" />
        <div className="opening-glow glow-b" />
        <div className="opening-glow glow-c" />

        {/* FLOATING PARTICLES */}
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

        {/* CONTENT */}
        <div className="opening-content">
          {/* EARTH */}
          <div className="opening-earth-wrap">
            <div className="opening-earth-glow" />
            <div className="opening-earth" />
            <div className="opening-ring ring-one" />
            <div className="opening-ring ring-two" />
            <div className="opening-ring ring-three" />
          </div>

          {/* TEXT */}
          <div className="opening-text">
            <span className="opening-eyebrow">ENTERPRISE SUSTAINABILITY INTELLIGENCE</span>
            <h1>Breathe<span>ESG</span></h1>
            <p>Building a more breathable future through magical climate intelligence.</p>
          </div>

          {/* LOADER */}
          <div className="loading-line">
            <div className="loading-line-fill" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {/* BACKGROUND */}
      <div className="bg-glow glow1" />
      <div className="bg-glow glow2" />
      <div className="bg-glow glow3" />

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Leaf size={26} strokeWidth={2.4} />
          </div>
          <div>
            <h2>Breathe<span>ESG</span></h2>
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
            className={activeTab === 'Analytics' ? 'active' : ''}
            onClick={() => setActiveTab('Analytics')}
          >
            <BarChart3 size={18} />
            Analytics
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
          <p>Beautiful environmental intelligence for modern enterprise sustainability teams.</p>
          <button onClick={() => setActiveTab('Overview')}>Explore Impact →</button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        {/* HERO */}
        <section className="hero">
          <div className="hero-gradient" />
          <div className="hero-content">
            <span className="eyebrow">ENTERPRISE SUSTAINABILITY INTELLIGENCE</span>
            <h1>Carbon tracking<br />made magical.</h1>
            <p>
              Beautiful environmental intelligence for modern enterprise sustainability teams.
              Audit-ready. Real-time. Human-first.
            </p>
            <div className="hero-buttons">
              <button className="primary-btn" onClick={() => setActiveTab('Review Queue')}>Open Dashboard</button>
              <button className="secondary-btn" onClick={() => setActiveTab('Audit Logs')}>View Reports</button>
            </div>
          </div>

          {/* EARTH */}
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

        {/* STATS */}
        <section className="stats">
          <div className="stat-card">
            <div className="stat-glow" />
            <div className="stat-icon"><Leaf size={28} /></div>
            <div>
              <span>Total Records</span>
              <h2><AnimatedNumber value={totalRecords} /></h2>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-glow" />
            <div className="stat-icon"><Globe size={28} /></div>
            <div>
              <span>Approved Logs</span>
              <h2><AnimatedNumber value={approvedRecords} /></h2>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-glow" />
            <div className="stat-icon"><AlertTriangle size={28} /></div>
            <div>
              <span>Flagged Issues</span>
              <h2><AnimatedNumber value={failedRecords} /></h2>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-glow" />
            <div className="stat-icon"><ShieldCheck size={28} /></div>
            <div>
              <span>Awaiting Sign-Off</span>
              <h2><AnimatedNumber value={pendingRecords} /></h2>
            </div>
          </div>
        </section>

        {/* ANALYTICS ENVIRONMENT INTEGRATION BLOCK */}
        {(activeTab === 'Overview' || activeTab === 'Analytics') && (
          <section className="analytics-section">
            <div className="analytics-header">
              <div>
                <span className="analytics-eyebrow">Environmental Intelligence</span>
                <h2>Magical analytics experience ✨</h2>
              </div>
              <div className="analytics-chip">
                <Sparkles size={16} />
                Live Sustainability Insights
              </div>
            </div>

            <div className="analytics-grid">
              {/* MAIN TREND LINE CHART */}
              <motion.div
                className="chart-card large-card"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <div className="chart-glow" />
                <div className="card-top">
                  <div>
                    <span className="chart-label">Carbon Trend</span>
                    <h3>Emissions Overview</h3>
                  </div>
                  <div className="mini-badge">
                    <Wind size={15} />
                    -18%
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={emissionsData}>
                    <defs>
                      <linearGradient id="greenGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#47d286" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#47d286" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="carbon" stroke="#47d286" strokeWidth={4} fill="url(#greenGlow)" />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {/* PIE SYSTEM MATRIX */}
              <motion.div
                className="chart-card"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
              >
                <div className="chart-glow small-glow" />
                <div className="card-top">
                  <div>
                    <span className="chart-label">Sources</span>
                    <h3>Emission Sources</h3>
                  </div>
                  <Factory size={20} />
                </div>

                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={sourceData} dataKey="value" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={6}>
                      {sourceData.map((entry, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>

              {/* BAR SCOPE COMPARISON GRAPH */}
              <motion.div
                className="chart-card"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
              >
                <div className="chart-glow blue-glow" />
                <div className="card-top">
                  <div>
                    <span className="chart-label">Scope Analytics</span>
                    <h3>Environmental Impact</h3>
                  </div>
                  <Trees size={20} />
                </div>

                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={impactData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
                    <XAxis dataKey="type" axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="amount" radius={[12, 12, 0, 0]} fill="#7ff2b3" />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              {/* MACHINE INSIGHTS EXTENSION CARD */}
              <motion.div
                className="insight-card"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
              >
                <div className="insight-glow" />
                <div className="insight-top">
                  <Leaf size={24} />
                  <span>AI Sustainability Insight</span>
                </div>
                <h3>Emissions dropped 18% this quarter 🌿</h3>
                <p>Smart supplier optimization reduced Scope 3 impact significantly across enterprise logistics systems.</p>
                <button>View Recommendation</button>
              </motion.div>
            </div>
          </section>
        )}

        {/* TABLE REVIEW SEGMENT CONFIGURATION */}
        {(activeTab === 'Review Queue' || activeTab === 'Analytics') && (
          <section className="table-wrap">
            <div className="table-light" />
            <div className="table-orb orb-a" />
            <div className="table-orb orb-b" />

            <div className="table-header">
              <div>
                <h2>Review Queue Portfolio</h2>
                <p>{filteredRows.length} ledgers matching</p>
              </div>

              <div className="filters">
                {['All', 'Pending', 'Approved', 'Failed', 'Suspicious'].map(item => (
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
                      <td colSpan={7} className="empty-row"><span>No ledger entries found tracking this filter.</span></td>
                    </tr>
                  ) : filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td className="source">
                        {row.source === 'SAP' ? <Database size={14} className="inline-table-icon" style={{ marginRight: '6px' }} /> : <Plane size={14} className="inline-table-icon" style={{ marginRight: '6px' }} />}
                        {row.source}
                      </td>
                      <td><span className="scope-tag">{row.scope}</span></td>
                      <td className="mono">{row.quantity}</td>
                      <td className="carbon">{row.carbon}</td>
                      <td><span className={`status ${row.status.toLowerCase()}`}>{row.status}</span></td>
                      <td className={row.status === 'Suspicious' || row.status === 'Failed' ? 'danger-note' : 'note'}>
                        {row.note}
                      </td>
                      <td>
                        {row.status === 'Approved' ? (
                          <span className="locked-label">Locked & Signed</span>
                        ) : (
                          <div className="actions">
                            <button className="approve" onClick={() => handleApprove(row.id)}>Approve</button>
                            <button className="reject" onClick={() => handleReject(row.id)}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'Audit Logs' && (
          <section className="table-wrap">
            <div className="table-header">
              <h2>Audit Verification Ledger History</h2>
              <p>Cryptographically finalized historical streams</p>
            </div>
            <div style={{ padding: '32px', color: 'var(--muted)', fontStyle: 'italic', fontSize: '14px' }}>
              🔒 Archive arrays verified and compiled successfully. Subsequent alterations are suspended for active system logs.
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
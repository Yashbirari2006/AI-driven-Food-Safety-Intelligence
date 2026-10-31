
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type RiskAssessment = {
  id: number
  riskScore: number | null
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | null
  status: string
  evidenceQuality: string
  humanReviewRequired: boolean
  advisoryOnly?: boolean
  realWorldValidated?: boolean
  dataStatus?: string
  assessedAt: string
}
type TriageReason = {
  code: string
  description: string
}

type ComplaintTriage = {
  id: number
  urgency: 'URGENT' | 'HIGH' | 'NORMAL'
  actionability: 'ACTIONABLE' | 'NEEDS_INFORMATION' | 'REVIEW_REQUIRED'
  reasons: TriageReason[]
  inputSnapshot: unknown
  rulesVersion: string
  assessedAt: string
}

type Complaint = {
  id: number
  referenceId: string
  title: string
  description: string
  foodType: string
  establishmentName: string
  establishmentId?: number | null
  location: string
  incidentDate: string
  status: string
  createdAt: string
  priority:
    | 'HIGH_REVIEW'
    | 'MEDIUM_REVIEW'
    | 'LOW_REVIEW'
    | 'ASSESSMENT_PENDING'
  latestAssessment: RiskAssessment | null
  latestTriage: ComplaintTriage | null
  triagePriority:
  | 'URGENT_REVIEW'
  | 'HIGH_REVIEW'
  | 'NORMAL_REVIEW'
  | 'INFORMATION_NEEDED'
  | 'TRIAGE_PENDING'
}

type Establishment = {
  id: number
  name: string
  establishmentType: string
  address: string
  district: string | null
  licenseNumber: string | null
  createdAt: string
  updatedAt: string
  _count?: { complaints: number }
}

type EstablishmentHistory = {
  establishment: Establishment & {
    licenceVerificationStatus?: string
  }
  previousComplaintCount: number
  previousComplaints: Array<{
    id: number
    title: string
    status: string
    incidentDate: string
    createdAt: string
    establishmentName: string
  }>
  verifiedRecordCount: number
  verifiedRecords: Array<{
    id: number
    recordType: string
    description: string
    sourceType: string
    sourceReference?: string | null
    verified: boolean
    occurredAt?: string | null
    createdAt: string
  }>
  note: string
}

type QueueResponse = {
  message: string
  count: number
  note: string
  complaints: Complaint[]
}

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || ''
).replace(/\/$/, '')

function formatDate(value?: string | null) {
  if (!value) return 'Not available'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString()
}

function priorityLabel(priority: Complaint['priority']) {
  switch (priority) {
    case 'HIGH_REVIEW':
      return 'High review priority'
    case 'MEDIUM_REVIEW':
      return 'Medium review priority'
    case 'LOW_REVIEW':
      return 'Low review priority'
    default:
      return 'Assessment pending'
  }
}

export default function OfficerDashboard() {
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'complaints' | 'analytics' | 'establishments'>(
    'complaints'
  )

  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [queueNote, setQueueNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [expandedComplaintId, setExpandedComplaintId] = useState<number | null>(
    null
  )
  const [reviewSavingId, setReviewSavingId] = useState<number | null>(null)
  const [reviewActionError, setReviewActionError] = useState('')
  const [riskInsightOpenId, setRiskInsightOpenId] = useState<number | null>(null)

  const [establishments, setEstablishments] = useState<Establishment[]>([])
  const [establishmentsLoading, setEstablishmentsLoading] = useState(false)
  const [establishmentError, setEstablishmentError] = useState('')
  const [establishmentMessage, setEstablishmentMessage] = useState('')
  const [establishmentSaving, setEstablishmentSaving] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('Restaurant')
  const [newAddress, setNewAddress] = useState('')
  const [newDistrict, setNewDistrict] = useState('')
  const [newLicenseNumber, setNewLicenseNumber] = useState('')

  const [linkComplaintId, setLinkComplaintId] = useState('')
  const [linkEstablishmentId, setLinkEstablishmentId] = useState('')
  const [linkSaving, setLinkSaving] = useState(false)

  const [history, setHistory] = useState<EstablishmentHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const getToken = () => sessionStorage.getItem('foster_token')

  const handleUnauthorized = () => {
    sessionStorage.removeItem('foster_token')
    sessionStorage.removeItem('foster_user')
    navigate('/login/officer', { replace: true })
  }

  const apiRequest = async (path: string, init: RequestInit = {}) => {
    const token = getToken()

    if (!token) {
      handleUnauthorized()
      throw new Error('Your session has expired. Please sign in again.')
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json().catch(() => ({}))

    if (response.status === 401) {
      handleUnauthorized()
      throw new Error('Your session has expired. Please sign in again.')
    }

    if (!response.ok) {
      throw new Error(data.message || `Request failed (${response.status}).`)
    }

    return data
  }

  const loadQueue = useCallback(async () => {
    const token = getToken()
    const storedUser = sessionStorage.getItem('foster_user')

    if (!token || !storedUser) {
      navigate('/login/officer', { replace: true })
      return
    }

    try {
      const user = JSON.parse(storedUser)

      if (user.role !== 'FOOD_SAFETY_OFFICER') {
        setError('This portal is available only to food safety officers.')
        setLoading(false)
        return
      }
    } catch {
      handleUnauthorized()
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await apiRequest('/api/complaints/officer/queue')
      const result = data as QueueResponse

      setComplaints(result.complaints || [])
      setQueueNote(result.note || '')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load the officer complaint queue.'
      )
    } finally {
      setLoading(false)
    }
  }, [navigate])

  const loadEstablishments = useCallback(async () => {
    setEstablishmentsLoading(true)
    setEstablishmentError('')
    setEstablishmentMessage('')

    try {
      const data = await apiRequest(
        '/api/complaints/officer/establishments'
      )

      setEstablishments(data.establishments || [])
    } catch (err) {
      setEstablishmentError(
        err instanceof Error
          ? err.message
          : 'Unable to load establishments.'
      )
    } finally {
      setEstablishmentsLoading(false)
    }
  }, [navigate])

  useEffect(() => {
  void Promise.all([loadQueue(), loadEstablishments()])
}, [loadQueue, loadEstablishments])

  async function markComplaintUnderReview(complaintId: number) {
    const confirmed = window.confirm(
      'Mark this complaint as UNDER REVIEW? This action will be recorded in the audit log.'
    )

    if (!confirmed) return

    setReviewSavingId(complaintId)
    setReviewActionError('')

    try {
      await apiRequest(
        `/api/complaints/officer/${complaintId}/status`,
        { method: 'PATCH' }
      )

      await loadQueue()
    } catch (err) {
      setReviewActionError(
        err instanceof Error
          ? err.message
          : 'Unable to update complaint status.'
      )
    } finally {
      setReviewSavingId(null)
    }
  }

  async function createEstablishment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEstablishmentSaving(true)
    setEstablishmentError('')
    setEstablishmentMessage('')

    try {
      const payload = {
        name: newName.trim(),
        establishmentType: newType,
        address: newAddress.trim(),
        district: newDistrict.trim() || undefined,
        licenseNumber: newLicenseNumber.trim() || undefined,
      }

      await apiRequest('/api/complaints/officer/establishments', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setNewName('')
      setNewType('Restaurant')
      setNewAddress('')
      setNewDistrict('')
      setNewLicenseNumber('')
      setShowCreateForm(false)
      setEstablishmentMessage(
        'Establishment registry entry created. Licence verification has not been established by this registration.'
      )

      await loadEstablishments()
    } catch (err) {
      setEstablishmentError(
        err instanceof Error
          ? err.message
          : 'Unable to create establishment.'
      )
    } finally {
      setEstablishmentSaving(false)
    }
  }

  async function linkComplaint(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!linkComplaintId || !linkEstablishmentId) {
      setEstablishmentError('Select both a complaint and an establishment.')
      return
    }

    const complaint = complaints.find(
      item => item.id === Number(linkComplaintId)
    )
    const establishment = establishments.find(
      item => item.id === Number(linkEstablishmentId)
    )

    if (!complaint || !establishment) {
      setEstablishmentError('The selected complaint or establishment is unavailable.')
      return
    }

    if (complaint.establishmentId && complaint.establishmentId !== establishment.id) {
      setEstablishmentError(
        'This complaint is already linked to another establishment. Existing links cannot be silently replaced.'
      )
      return
    }

    const confirmed = window.confirm(
      `Link complaint ${complaint.referenceId} to "${establishment.name}"?\n\nConfirm that the establishment identity has been appropriately checked. A similar name alone is not proof of identity.`
    )

    if (!confirmed) return

    setLinkSaving(true)
    setEstablishmentError('')
    setEstablishmentMessage('')

    try {
      await apiRequest(
        `/api/complaints/officer/${complaint.id}/establishment`,
        {
          method: 'PATCH',
          body: JSON.stringify({ establishmentId: establishment.id }),
        }
      )

      setLinkComplaintId('')
      setLinkEstablishmentId('')
      setEstablishmentMessage(
        `Complaint ${complaint.referenceId} linked to registry entry "${establishment.name}". This link does not confirm the allegation or licence status.`
      )

      await Promise.all([loadQueue(), loadEstablishments()])
    } catch (err) {
      setEstablishmentError(
        err instanceof Error ? err.message : 'Unable to link complaint.'
      )
    } finally {
      setLinkSaving(false)
    }
  }

  async function viewHistory(establishmentId: number) {
    setHistory(null)
    setHistoryLoading(true)
    setEstablishmentError('')
    setEstablishmentMessage('')

    try {
      const data = await apiRequest(
        `/api/complaints/officer/establishments/${establishmentId}/history`
      )

      setHistory(data as EstablishmentHistory)
    } catch (err) {
      setEstablishmentError(
        err instanceof Error
          ? err.message
          : 'Unable to load establishment history.'
      )
    } finally {
      setHistoryLoading(false)
    }
  }

  function logout() {
    sessionStorage.removeItem('foster_token')
    sessionStorage.removeItem('foster_user')
    navigate('/login/officer', { replace: true })
  }

  const normalizedSearch = search.trim().toLowerCase()

  const filteredComplaints = complaints.filter(complaint => {
    const matchesSearch = [
      complaint.referenceId,
      complaint.title,
      complaint.establishmentName,
      complaint.location,
      complaint.foodType,
    ]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(normalizedSearch))

    const matchesFilter =
      filter === 'ALL' || complaint.priority === filter

    return matchesSearch && matchesFilter
  })

  const pendingCount = complaints.filter(
    item => item.priority === 'ASSESSMENT_PENDING'
  ).length

  const assessmentCount = complaints.length - pendingCount

  const unlinkedComplaints = complaints.filter(
    item => !item.establishmentId
  )

  return (
    <main className="officer-page">
      <header className="officer-header">
        <div className="officer-brand">
          <span className="officer-brand-mark">F</span>
          <div>
            <strong>FOSTER AI</strong>
            <span>Food Safety Intelligence</span>
          </div>
        </div>

        <div className="officer-header-actions">
          <span className="officer-role">Food Safety Officer</span>
          <button type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <section className="officer-content">
        <div className="officer-welcome">
          <div>
            <p className="officer-eyebrow">OFFICER WORKSPACE</p>
            <h1>Food Safety Operations</h1>
            <p>
              Review submitted complaints and manage establishment
              registry records with appropriate human oversight.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
  void Promise.all([loadQueue(), loadEstablishments()])
}}
            disabled={loading || establishmentsLoading}
          >
            Refresh {
  activeTab === 'complaints'
    ? 'queue'
    : activeTab === 'analytics'
      ? 'analytics'
      : 'registry'
}
          </button>
        </div>

        <nav className="officer-tabs" aria-label="Officer workspace sections">
          <button
            type="button"
            className={activeTab === 'complaints' ? 'active' : ''}
            aria-current={activeTab === 'complaints' ? 'page' : undefined}
            onClick={() => setActiveTab('complaints')}
          >
            Complaint queue
            <span>{complaints.length}</span>
          </button>
          <button
  type="button"
  className={activeTab === 'analytics' ? 'active' : ''}
  aria-current={activeTab === 'analytics' ? 'page' : undefined}
  onClick={() => setActiveTab('analytics')}
>
  Analytics
</button>

          <button
            type="button"
            className={activeTab === 'establishments' ? 'active' : ''}
            aria-current={activeTab === 'establishments' ? 'page' : undefined}
            onClick={() => {
              setActiveTab('establishments')
              if (establishments.length === 0) void loadEstablishments()
            }}
          >
            Establishment registry
            <span>{establishments.length}</span>
          </button>
        </nav>

        {activeTab === 'complaints' && (
          <>
            <div className="officer-stats">
              <article className="officer-stat">
                <span>Total complaints</span>
                <strong>{complaints.length}</strong>
              </article>
              <article className="officer-stat">
                <span>Assessment recorded</span>
                <strong>{assessmentCount}</strong>
              </article>
              <article className="officer-stat">
                <span>Assessment pending</span>
                <strong>{pendingCount}</strong>
              </article>
            </div>

            <section className="officer-disclaimer">
              <strong>Experimental AI — human review required</strong>
              <p>
                Model predictions use synthetic training data and have not
                been validated for real-world food-safety decisions. A risk
                category is not an official finding and does not authorize
                enforcement action.
              </p>
              {queueNote && <small>{queueNote}</small>}
            </section>

            <section className="officer-queue">
              <div className="officer-queue-heading">
                <div>
                  <h2>Complaints</h2>
                  <p>Review the latest recorded assessment, if available.</p>
                </div>
                <span>{filteredComplaints.length} shown</span>
              </div>

              <div className="officer-controls">
                <input
                  aria-label="Search complaints"
                  placeholder="Search reference, establishment or location"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />

                <select
                  aria-label="Filter complaints"
                  value={filter}
                  onChange={event => setFilter(event.target.value)}
                >
                  <option value="ALL">All complaints</option>
                  <option value="ASSESSMENT_PENDING">Assessment pending</option>
                  <option value="HIGH_REVIEW">High review priority</option>
                  <option value="MEDIUM_REVIEW">Medium review priority</option>
                  <option value="LOW_REVIEW">Low review priority</option>
                </select>
              </div>

              {loading && (
                <p className="officer-feedback">Loading complaint queue…</p>
              )}

              {!loading && error && (
                <div className="officer-error" role="alert">
                  <p>{error}</p>
                  <button type="button" onClick={() => void loadQueue()}>
                    Try again
                  </button>
                </div>
              )}

              {!loading && !error && filteredComplaints.length === 0 && (
                <p className="officer-feedback">
                  No complaints match this search or filter.
                </p>
              )}

              {!loading && !error && filteredComplaints.length > 0 && (
                <div className="officer-complaint-list">
                  {filteredComplaints.map(complaint => (
                    <article
                      className="officer-complaint-card"
                      key={complaint.id}
                    >
                      <div className="officer-card-top">
                        <div>
                          <span className="officer-reference">
                            {complaint.referenceId}
                          </span>
                          <h3>{complaint.title}</h3>
                        </div>
                        <span
                          className={`officer-priority priority-${complaint.priority.toLowerCase()}`}
                        >
                          {priorityLabel(complaint.priority)}
                        </span>
                      </div>

                      <p className="officer-description">
                        {complaint.description}
                      </p>

                      <dl className="officer-details">
                        <div>
                          <dt>Reported establishment</dt>
                          <dd>{complaint.establishmentName || 'Not provided'}</dd>
                        </div>
                        <div>
                          <dt>Registry link</dt>
                          <dd>
                            {complaint.establishmentId
                              ? `Registry ID ${complaint.establishmentId}`
                              : 'Not linked'}
                          </dd>
                        </div>
                        <div>
                          <dt>Location</dt>
                          <dd>{complaint.location || 'Not provided'}</dd>
                        </div>
                        <div>
                          <dt>Food type</dt>
                          <dd>{complaint.foodType || 'Not provided'}</dd>
                        </div>
                        <div>
                          <dt>Incident date</dt>
                          <dd>{formatDate(complaint.incidentDate)}</dd>
                        </div>
                        <div>
                          <dt>Complaint status</dt>
                          <dd>{complaint.status.replace(/_/g, ' ')}</dd>
                        </div>
                        <div>
                          <dt>Submitted</dt>
                          <dd>{formatDate(complaint.createdAt)}</dd>
                        </div>
                      </dl>

                      <div className="officer-review-actions">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedComplaintId(current =>
                              current === complaint.id ? null : complaint.id
                            )
                          }
                          aria-expanded={expandedComplaintId === complaint.id}
                        >
                          {expandedComplaintId === complaint.id
                            ? 'Hide review details'
                            : 'Review details'}
                        </button>

                        {!complaint.establishmentId && (
                          <button
                            type="button"
                            className="registry-secondary-button"
                            onClick={() => {
                              setActiveTab('establishments')
                              setLinkComplaintId(String(complaint.id))
                              setLinkEstablishmentId('')
                              setEstablishmentMessage('')
                              setEstablishmentError('')
                              if (establishments.length === 0) {
                                void loadEstablishments()
                              }
                            }}
                          >
                            Link establishment
                          </button>
                        )}
                      </div>

                      {expandedComplaintId === complaint.id && (
                        <section className="officer-review-panel">
                          <h4>Officer review workspace</h4>
                          <p>
                            Review the submitted description and available
                            evidence before making any decision.
                          </p>
                          <p>
                            <strong>Reference:</strong> {complaint.referenceId}
                          </p>
                          <p>
                            <strong>Reported concern:</strong>{' '}
                            {complaint.description}
                          </p>
                          <p>
                            <strong>Current status:</strong>{' '}
                            {complaint.status.replace(/_/g, ' ')}
                          </p>
                          <div className="officer-assessment">
  <h4>Automatic Complaint Triage</h4>

  {!complaint.latestTriage ? (
    <p>
      No initial triage record is available for this complaint.
    </p>
  ) : (
    <>
      <p>
        <strong>Urgency:</strong>{' '}
        {complaint.latestTriage.urgency}
      </p>

      <p>
        <strong>Actionability:</strong>{' '}
        {complaint.latestTriage.actionability.replace(/_/g, ' ')}
      </p>

      <p>
        <strong>Rules version:</strong>{' '}
        {complaint.latestTriage.rulesVersion}
      </p>

      <p>
        <strong>Recorded:</strong>{' '}
        {formatDate(complaint.latestTriage.assessedAt)}
      </p>

      <strong>Triage reasons:</strong>

      {complaint.latestTriage.reasons.length > 0 ? (
        <ul>
          {complaint.latestTriage.reasons.map((reason, index) => (
            <li key={`${reason.code}-${index}`}>
              {reason.description}
            </li>
          ))}
        </ul>
      ) : (
        <p>No specific triage reasons were recorded.</p>
      )}

            <small>
        Triage is an initial rule-based screening of reported information.
        It does not establish a verified violation or authorize enforcement.
        Officer review is required.
      </small>

      <div className="officer-review-actions">
        <button
          type="button"
          onClick={() =>
            setRiskInsightOpenId(
              riskInsightOpenId === complaint.id ? null : complaint.id
            )
          }
        >
          {riskInsightOpenId === complaint.id
            ? 'Hide Risk Insight'
            : 'Generate Risk Insight'}
        </button>
      </div>

      {riskInsightOpenId === complaint.id && (
        <section className="officer-assessment">
          <h4>Complaint Risk Insight</h4>

          <p>
            <strong>Screening priority:</strong>{' '}
            {complaint.latestTriage.urgency}
          </p>

          <p>
            <strong>Information status:</strong>{' '}
            {complaint.latestTriage.actionability.replace(/_/g, ' ')}
          </p>

          <p>
            <strong>Assessment basis:</strong> Reported complaint details
            and rule-based triage ({complaint.latestTriage.rulesVersion}).
          </p>

          <strong>Attention points:</strong>

          {complaint.latestTriage.reasons.length > 0 ? (
            <ul>
              {complaint.latestTriage.reasons.map((reason, index) => (
                <li key={`insight-${reason.code}-${index}`}>
                  {reason.description}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No specific risk-related signals were identified by the
              current triage rules.
            </p>
          )}

          <strong>Suggested next action:</strong>

          <p>
            {complaint.latestTriage.actionability === 'NEEDS_INFORMATION'
              ? 'Obtain the missing complaint information before proceeding with further assessment.'
              : complaint.latestTriage.urgency === 'URGENT'
                ? 'Prioritize prompt officer review and verify the reported illness, affected persons and ongoing activity.'
                : complaint.latestTriage.urgency === 'HIGH'
                  ? 'Prioritize officer review and verify the reported concern using appropriate evidence.'
                  : 'Review the reported details and determine whether further information or inspection is warranted.'}
          </p>

          <small>
            This is a rule-based advisory insight, not an ML prediction or
            verified food-safety risk determination. Reported signals are
            unverified allegations. The authorized officer must independently
            assess the evidence and decide the next action.
          </small>
        </section>
      )}
    </>
  )}
</div>
                          <p>
                            <strong>Review reminder:</strong> An experimental
                            AI risk category is advisory only and is not an
                            official finding.
                          </p>
                          <p className="officer-review-note">
                            This view does not save a review decision.
                          </p>
                        </section>
                      )}

                      {complaint.status === 'SUBMITTED' && (
                        <div className="officer-review-actions">
                          <button
                            type="button"
                            disabled={reviewSavingId !== null}
                            onClick={() =>
                              void markComplaintUnderReview(complaint.id)
                            }
                          >
                            {reviewSavingId === complaint.id
                              ? 'Saving review…'
                              : 'Mark under review'}
                          </button>
                        </div>
                      )}

                      {reviewActionError && (
                        <p className="officer-error" role="alert">
                          {reviewActionError}
                        </p>
                      )}

                      <div className="officer-assessment">
                        <h4>Latest recorded risk assessment</h4>

                        {!complaint.latestAssessment ? (
                          <p>
                            No risk assessment is recorded for this complaint.
                          </p>
                        ) : (
                          <>
                            <p>
                              <strong>Provisional category:</strong>{' '}
                              {complaint.latestAssessment.riskLevel || 'Unavailable'}
                            </p>
                            <p>
                              <strong>Assessment status:</strong>{' '}
                              {complaint.latestAssessment.status}
                            </p>
                            <p>
                              <strong>Evidence quality:</strong>{' '}
                              {complaint.latestAssessment.evidenceQuality}
                            </p>
                            <p>
                              <strong>Human review required:</strong>{' '}
                              {complaint.latestAssessment.humanReviewRequired
                                ? 'Yes'
                                : 'Not indicated'}
                            </p>
                            <p>
                              <strong>Recorded:</strong>{' '}
                              {formatDate(complaint.latestAssessment.assessedAt)}
                            </p>
                            <small>
                              This is a recorded assessment, not a verified
                              food-safety determination.
                            </small>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
        {activeTab === 'analytics' && (() => {
  const total = complaints.length

  const priorityData = [
    {
      label: 'High priority',
      count: complaints.filter(c => c.priority === 'HIGH_REVIEW').length,
      color: '#dc5555',
    },
    {
      label: 'Medium priority',
      count: complaints.filter(c => c.priority === 'MEDIUM_REVIEW').length,
      color: '#e6a23c',
    },
    {
      label: 'Low priority',
      count: complaints.filter(c => c.priority === 'LOW_REVIEW').length,
      color: '#299c78',
    },
    {
      label: 'Assessment pending',
      count: pendingCount,
      color: '#718096',
    },
  ]

  const statusData = ['SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED']
    .map(status => ({
      label: status.replace(/_/g, ' '),
      count: complaints.filter(c => c.status === status).length,
    }))

  const categories = complaints.reduce<Record<string, number>>((acc, c) => {
    const raw = c.foodType?.trim() || 'Not provided'
    const name = raw.toLowerCase() === 'prepared food'
      ? 'Prepared Food'
      : raw.replace(/\b\w/g, char => char.toUpperCase())

    acc[name] = (acc[name] || 0) + 1
    return acc
  }, {})

  const locations = complaints.reduce<Record<string, number>>((acc, c) => {
    const name = c.location?.trim() || 'Not provided'
    acc[name] = (acc[name] || 0) + 1
    return acc
  }, {})

  const categoryData = Object.entries(categories).sort((a, b) => b[1] - a[1])
  const locationData = Object.entries(locations).sort((a, b) => b[1] - a[1])

  return (
    <section className="analytics-dashboard">

      <div className="analytics-heading">
        <div>
          <span className="analytics-eyebrow">PERFORMANCE OVERVIEW</span>
          <h2>Complaint Analytics</h2>
          <p>Understand complaint volume, review priorities and reported patterns.</p>
        </div>
        <span className="analytics-record-count">{total} Reports</span>
      </div>

      <div className="analytics-summary-grid">
        <article className="analytics-summary-card blue">
          <span>Total Reports</span>
          <strong>{total}</strong>
          <small>All recorded complaints</small>
        </article>

        <article className="analytics-summary-card red">
          <span>High Priority</span>
          <strong>{priorityData[0].count}</strong>
          <small>Requires priority review</small>
        </article>

        <article className="analytics-summary-card amber">
          <span>Assessment Pending</span>
          <strong>{pendingCount}</strong>
          <small>Awaiting risk assessment</small>
        </article>

        <article className="analytics-summary-card green">
          <span>Resolved</span>
          <strong>{statusData.find(s => s.label === 'RESOLVED')?.count ?? 0}</strong>
          <small>Recorded as resolved</small>
        </article>
      </div>

      <div className="analytics-panel-grid">

        <article className="analytics-panel">
          <h3>Review Priority Distribution</h3>
          <p className="analytics-panel-subtitle">
            Distribution of recorded review priorities
          </p>

          {priorityData.map(item => (
            <div className="analytics-bar-item" key={item.label}>
              <div className="analytics-bar-heading">
                <span>{item.label}</span>
                <strong>{item.count} ({total ? Math.round(item.count / total * 100) : 0}%)</strong>
              </div>
              <div className="analytics-track">
                <div
                  className="analytics-fill"
                  style={{
                    width: `${total ? item.count / total * 100 : 0}%`,
                    background: item.color,
                  }}
                />
              </div>
            </div>
          ))}
        </article>

        <article className="analytics-panel">
          <h3>Complaint Status</h3>
          <p className="analytics-panel-subtitle">
            Current workflow status of reports
          </p>

          {statusData.map(item => (
            <div className="analytics-bar-item" key={item.label}>
              <div className="analytics-bar-heading">
                <span>{item.label}</span>
                <strong>{item.count} ({total ? Math.round(item.count / total * 100) : 0}%)</strong>
              </div>
              <div className="analytics-track">
                <div
                  className="analytics-fill"
                  style={{
                    width: `${total ? item.count / total * 100 : 0}%`,
                    background: '#4387d8',
                  }}
                />
              </div>
            </div>
          ))}
        </article>

        <article className="analytics-panel">
          <h3>Food Category Analysis</h3>
          <p className="analytics-panel-subtitle">
            Number of complaints by reported food category
          </p>

          {categoryData.length === 0 ? (
            <p>No category data available.</p>
          ) : categoryData.map(([name, count]) => (
            <div className="analytics-bar-item" key={name}>
              <div className="analytics-bar-heading">
                <span>{name}</span>
                <strong>{count}</strong>
              </div>
              <div className="analytics-track">
                <div
                  className="analytics-fill"
                  style={{
                    width: `${Math.max(...categoryData.map(x => x[1])) ? count / Math.max(...categoryData.map(x => x[1])) * 100 : 0}%`,
                    background: '#269c83',
                  }}
                />
              </div>
            </div>
          ))}
        </article>

        <article className="analytics-panel">
          <h3>Location Analysis</h3>
          <p className="analytics-panel-subtitle">
            Reports grouped by their recorded location
          </p>

          {locationData.length === 0 ? (
            <p>No location data available.</p>
          ) : locationData.map(([name, count]) => (
            <div className="analytics-location-row" key={name}>
              <span>{name}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </article>

      </div>

      <div className="analytics-notice">
        <strong>Important interpretation notice</strong>
        <p>
          These statistics describe submitted complaints and experimental
          review priorities. They are not verified food-safety violations,
          official risk determinations or evidence of confirmed contamination.
        </p>
      </div>

    </section>
  )
})()}
        {activeTab === 'establishments' && (
          <section className="registry-section">
            <div className="registry-heading">
              <div>
                <p className="officer-eyebrow">REGISTRY MANAGEMENT</p>
                <h2>Establishment Registry</h2>
                <p>
                  Maintain establishment identity records and inspect linked
                  complaint history.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(value => !value)
                  setEstablishmentError('')
                  setEstablishmentMessage('')
                }}
              >
                {showCreateForm ? 'Cancel registration' : '+ Register establishment'}
              </button>
            </div>

            <div className="registry-disclaimer">
              <strong>Registry record ≠ verified licence</strong>
              <p>
                Registering an establishment does not verify its licence,
                compliance or food-safety status. Complaint reports are
                allegations, not confirmed violations. Link complaints only
                when the establishment identity has been appropriately checked.
              </p>
            </div>

            {establishmentError && (
              <p className="registry-alert registry-alert-error" role="alert">
                {establishmentError}
              </p>
            )}

            {establishmentMessage && (
              <p className="registry-alert registry-alert-success" role="status">
                {establishmentMessage}
              </p>
            )}

            {showCreateForm && (
              <form className="registry-form" onSubmit={createEstablishment}>
                <h3>Register a new establishment</h3>

                <label>
                  Establishment name *
                  <input
                    required
                    maxLength={160}
                    value={newName}
                    onChange={event => setNewName(event.target.value)}
                    placeholder="e.g. Example Restaurant"
                  />
                </label>

                <label>
                  Establishment type *
                  <select
                    required
                    value={newType}
                    onChange={event => setNewType(event.target.value)}
                  >
                    <option value="Restaurant">Restaurant</option>
                    <option value="Street Food Vendor">Street food vendor</option>
                    <option value="Food Manufacturer">Food manufacturer</option>
                    <option value="Retail Food Shop">Retail food shop</option>
                    <option value="Catering Service">Catering service</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <label>
                  Address *
                  <input
                    required
                    maxLength={300}
                    value={newAddress}
                    onChange={event => setNewAddress(event.target.value)}
                    placeholder="Full establishment address"
                  />
                </label>

                <label>
                  District
                  <input
                    maxLength={100}
                    value={newDistrict}
                    onChange={event => setNewDistrict(event.target.value)}
                    placeholder="District"
                  />
                </label>

                <label>
                  Licence number (optional)
                  <input
                    maxLength={100}
                    value={newLicenseNumber}
                    onChange={event => setNewLicenseNumber(event.target.value)}
                    placeholder="Record only if available"
                  />
                </label>

                <p className="registry-field-note">
                  Entering a licence number here does not independently verify it.
                </p>

                <button type="submit" disabled={establishmentSaving}>
                  {establishmentSaving ? 'Registering…' : 'Save registry entry'}
                </button>
              </form>
            )}

            <section className="registry-link-panel">
              <h3>Link a complaint to a registry entry</h3>
              <p>
                This is a manual association, not an automatic identity match.
                Similar names alone are not sufficient proof.
              </p>

              <form className="registry-link-form" onSubmit={linkComplaint}>
                <label>
                  Unlinked complaint
                  <select
                    required
                    value={linkComplaintId}
                    onChange={event => setLinkComplaintId(event.target.value)}
                  >
                    <option value="">Select a complaint</option>
                    {unlinkedComplaints.map(complaint => (
                      <option key={complaint.id} value={complaint.id}>
                        {complaint.referenceId} — {complaint.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Registry entry
                  <select
                    required
                    value={linkEstablishmentId}
                    onChange={event => setLinkEstablishmentId(event.target.value)}
                  >
                    <option value="">Select an establishment</option>
                    {establishments.map(establishment => (
                      <option key={establishment.id} value={establishment.id}>
                        {establishment.name} — ID {establishment.id}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="submit"
                  disabled={
                    linkSaving ||
                    establishments.length === 0 ||
                    unlinkedComplaints.length === 0
                  }
                >
                  {linkSaving ? 'Linking…' : 'Review and link'}
                </button>
              </form>
            </section>

            <div className="registry-list-heading">
              <h3>Registered establishments</h3>
              <span>{establishments.length} records</span>
            </div>

            {establishmentsLoading && (
              <p className="officer-feedback">Loading registry…</p>
            )}

            {!establishmentsLoading && establishments.length === 0 && (
              <p className="registry-empty">
                No establishment records found. Register a record to begin.
              </p>
            )}

            {!establishmentsLoading && establishments.length > 0 && (
              <div className="registry-cards">
                {establishments.map(establishment => (
                  <article className="registry-card" key={establishment.id}>
                    <div className="registry-card-top">
                      <div>
                        <span className="registry-id">
                          Registry ID {establishment.id}
                        </span>
                        <h3>{establishment.name}</h3>
                      </div>
                      <span className="registry-status">
                        Licence unverified
                      </span>
                    </div>

                    <dl className="registry-details">
                      <div>
                        <dt>Type</dt>
                        <dd>{establishment.establishmentType}</dd>
                      </div>
                      <div>
                        <dt>Address</dt>
                        <dd>{establishment.address}</dd>
                      </div>
                      <div>
                        <dt>District</dt>
                        <dd>{establishment.district || 'Not provided'}</dd>
                      </div>
                      <div>
                        <dt>Licence number</dt>
                        <dd>{establishment.licenseNumber || 'Not recorded'}</dd>
                      </div>
                      <div>
                        <dt>Linked complaints</dt>
                        <dd>{establishment._count?.complaints ?? '—'}</dd>
                      </div>
                    </dl>

                    <button
                      type="button"
                      className="registry-secondary-button"
                      onClick={() => void viewHistory(establishment.id)}
                      disabled={historyLoading}
                    >
                      {historyLoading && history?.establishment.id === establishment.id
                        ? 'Loading history…'
                        : 'View complaint history'}
                    </button>
                  </article>
                ))}
              </div>
            )}

            {historyLoading && (
              <p className="officer-feedback">Loading establishment history…</p>
            )}

            {history && (
              <section className="registry-history">
                <div className="registry-history-heading">
                  <div>
                    <p className="officer-eyebrow">ESTABLISHMENT HISTORY</p>
                    <h3>{history.establishment.name}</h3>
                  </div>
                  <button
                    type="button"
                    className="registry-secondary-button"
                    onClick={() => setHistory(null)}
                  >
                    Close history
                  </button>
                </div>

                <p className="registry-history-note">{history.note}</p>

                <div className="registry-history-stats">
                  <div>
                    <span>Previous complaints</span>
                    <strong>{history.previousComplaintCount}</strong>
                  </div>
                  <div>
                    <span>Verified records</span>
                    <strong>{history.verifiedRecordCount}</strong>
                  </div>
                </div>

                <h4>Complaint reports</h4>

                {history.previousComplaints.length === 0 ? (
                  <p>No linked complaints are recorded.</p>
                ) : (
                  <div className="registry-history-list">
                    {history.previousComplaints.map(item => (
                      <article key={item.id}>
                        <strong>{item.title}</strong>
                        <span>Complaint ID {item.id}</span>
                        <span>Status: {item.status.replace(/_/g, ' ')}</span>
                        <span>Incident date: {formatDate(item.incidentDate)}</span>
                        <span>
                          Reported establishment name: {item.establishmentName || 'Not provided'}
                        </span>
                      </article>
                    ))}
                  </div>
                )}

                <h4>Verified establishment records</h4>

                {history.verifiedRecords.length === 0 ? (
                  <p>No verified establishment records are available.</p>
                ) : (
                  <div className="registry-history-list">
                    {history.verifiedRecords.map(record => (
                      <article key={record.id}>
                        <strong>{record.recordType}</strong>
                        <span>{record.description}</span>
                        <span>Source type: {record.sourceType}</span>
                        {record.sourceReference && (
                          <span>Source reference: {record.sourceReference}</span>
                        )}
                        <span>Occurred: {formatDate(record.occurredAt)}</span>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </section>
        )}
      </section>
    </main>
  )
}

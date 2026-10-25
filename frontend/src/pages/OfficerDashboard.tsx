
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

type Complaint = {
  id: number
  referenceId: string
  title: string
  description: string
  foodType: string
  establishmentName: string
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

function formatDate(value: string) {
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
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [queueNote, setQueueNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [expandedComplaintId, setExpandedComplaintId] = useState<number | null>(null)
  const [reviewSavingId, setReviewSavingId] = useState<number | null>(null)
const [reviewActionError, setReviewActionError] = useState('')
  const loadQueue = useCallback(async () => {
    const token = sessionStorage.getItem('foster_token')
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
      sessionStorage.removeItem('foster_token')
      sessionStorage.removeItem('foster_user')
      navigate('/login/officer', { replace: true })
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(
        `${API_BASE}/api/complaints/officer/queue`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await response.json().catch(() => ({}))

      if (response.status === 401) {
        sessionStorage.removeItem('foster_token')
        sessionStorage.removeItem('foster_user')
        navigate('/login/officer', { replace: true })
        return
      }

      if (!response.ok) {
        throw new Error(
          data.message || 'Unable to load the officer complaint queue.'
        )
      }

      const result = data as QueueResponse
      setComplaints(result.complaints || [])
      setQueueNote(result.note || '')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while loading complaints.'
      )
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

async function markComplaintUnderReview(complaintId: number) {
  const token = sessionStorage.getItem('foster_token')

  if (!token) {
    navigate('/login/officer', { replace: true })
    return
  }

  const confirmed = window.confirm(
    'Mark this complaint as UNDER REVIEW? This action will be recorded in the audit log.'
  )

  if (!confirmed) return

  setReviewSavingId(complaintId)
  setReviewActionError('')

  try {
    const response = await fetch(
      `${API_BASE}/api/complaints/officer/${complaintId}/status`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    const data = await response.json().catch(() => ({}))

    if (response.status === 401) {
      sessionStorage.removeItem('foster_token')
      sessionStorage.removeItem('foster_user')
      navigate('/login/officer', { replace: true })
      return
    }

    if (!response.ok) {
      throw new Error(
        data.message || 'Unable to update complaint status.'
      )
    }

    await loadQueue()
  } catch (err) {
    setReviewActionError(
      err instanceof Error
        ? err.message
        : 'Something went wrong while updating the complaint.'
    )
  } finally {
    setReviewSavingId(null)
  }
}

  function logout() {
    sessionStorage.removeItem('foster_token')
    sessionStorage.removeItem('foster_user')
    navigate('/login/officer', { replace: true })
  }

  const normalizedSearch = search.trim().toLowerCase()

  const filteredComplaints = complaints.filter((complaint) => {
    const matchesSearch = [
      complaint.referenceId,
      complaint.title,
      complaint.establishmentName,
      complaint.location,
      complaint.foodType,
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedSearch))

    const matchesFilter =
      filter === 'ALL' || complaint.priority === filter

    return matchesSearch && matchesFilter
  })

  const pendingCount = complaints.filter(
    (item) => item.priority === 'ASSESSMENT_PENDING'
  ).length

  const assessmentCount = complaints.length - pendingCount

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
            <h1>Complaint Review Queue</h1>
            <p>
              Review reported food-safety concerns and examine
              available assessment evidence.
            </p>
          </div>

          <button
            type="button"
            className="officer-refresh"
            onClick={() => void loadQueue()}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Refresh queue'}
          </button>
        </div>

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
            Model predictions are advisory, use synthetic training
            data, and are not validated for real-world food-safety
            decisions. A risk category is not an official finding
            and does not authorize enforcement action.
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
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              aria-label="Filter complaints"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
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
              {filteredComplaints.map((complaint) => (
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
                      <dt>Establishment</dt>
                      <dd>{complaint.establishmentName || 'Not provided'}</dd>
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
      setExpandedComplaintId((current) =>
        current === complaint.id ? null : complaint.id
      )
    }
    aria-expanded={expandedComplaintId === complaint.id}
  >
    {expandedComplaintId === complaint.id
      ? 'Hide review details'
      : 'Review details'}
  </button>
</div>

{expandedComplaintId === complaint.id && (
  <section className="officer-review-panel">
    <h4>Officer review workspace</h4>
    <p>
      Review the submitted description and available evidence before
      making any decision.
    </p>

    <p>
      <strong>Reference:</strong> {complaint.referenceId}
    </p>
    <p>
      <strong>Reported concern:</strong> {complaint.description}
    </p>
    <p>
      <strong>Current complaint status:</strong>{' '}
      {complaint.status.replace(/_/g, ' ')}
    </p>

    <p>
      <strong>Review reminder:</strong> An experimental AI risk
      category is advisory only and is not an official finding.
    </p>

    <p className="officer-review-note">
      This view does not save a review decision or change complaint status.
    </p>
  </section>
)}

{complaint.status === 'SUBMITTED' && (
  <div className="officer-review-actions">
    <button
      type="button"
      disabled={reviewSavingId !== null}
      onClick={() => void markComplaintUnderReview(complaint.id)}
    >
      {reviewSavingId === complaint.id
        ? 'Saving review...'
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
      </section>
    </main>
  )
}

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Download,
  FileCheck2,
  FileSpreadsheet,
  Filter,
  Loader2,
  MailCheck,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { API_BASE_URL, TURNSTILE_SITE_KEY } from '../../config';
import { apiFetch, parseJsonResponse } from '../../utils/api';
import TurnstileWidget from '../shared/TurnstileWidget';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const TERMINAL_JOB_STATUSES = new Set(['completed', 'cancelled', 'failed', 'expired']);
const ACTIVE_JOB_STATUSES = new Set(['queued', 'processing', 'partially_completed']);

const SUMMARY_ITEMS = [
  ['total', 'Total', 'neutral'],
  ['processed', 'Processed', 'info'],
  ['likelyDeliverable', 'Likely Deliverable', 'success'],
  ['delivered', 'Delivered', 'success'],
  ['openDetected', 'Open Detected', 'info'],
  ['clicked', 'Clicked', 'info'],
  ['confirmed', 'Confirmed', 'success'],
  ['undeliverable', 'Undeliverable', 'danger'],
  ['risky', 'Risky', 'warning'],
  ['catchAll', 'Catch-All', 'warning'],
  ['pending', 'Pending', 'warning'],
  ['failed', 'Failed', 'danger'],
];

const EMPTY_FILTERS = {
  search: '',
  technicalStatus: '',
  deliveryStatus: '',
  confirmationStatus: '',
  sort: 'confidence_desc',
};

function getExtension(filename = '') {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

function normalizeUpload(data) {
  const summary = data.summary || data.counts || {};
  return {
    ...data,
    jobId: data.jobId || data.id,
    accessToken: data.accessToken || data.jobAccessToken || data.token,
    columns: data.candidateColumns || data.columns || data.availableColumns || [],
    selectedColumn: data.emailColumn || data.selectedEmailColumn || '',
    needsColumn:
      Boolean(data.requiresColumnSelection || data.needsColumnSelection) ||
      data.status === 'column_required',
    preview: (data.preview || data.rows || []).slice(0, 20),
    summary: {
      total: summary.total ?? summary.totalRows ?? data.totalRows ?? 0,
      valid: summary.valid ?? summary.validRows ?? data.validRows ?? 0,
      invalid: summary.invalid ?? summary.invalidRows ?? data.invalidRows ?? 0,
      duplicates:
        summary.duplicates ?? summary.duplicateRows ?? data.duplicateRows ?? data.duplicatesRemoved ?? 0,
    },
    turnstileRequired: Boolean(data.turnstileRequired || data.requiresTurnstile),
  };
}

function normalizeStatus(data) {
  const source = data.summary || data.counts || data;
  return {
    ...data,
    jobId: data.jobId || data.id,
    status: data.status || 'processing',
    percentage: Math.max(0, Math.min(100, Number(data.percentage ?? data.progress ?? 0))),
    total: Number(source.total ?? source.totalRows ?? 0),
    processed: Number(source.processed ?? source.processedRows ?? 0),
    likelyDeliverable: Number(source.likelyDeliverable ?? source.likelyDeliverableRows ?? 0),
    delivered: Number(source.delivered ?? source.deliveredRows ?? 0),
    openDetected: Number(source.openDetected ?? source.openedRows ?? 0),
    clicked: Number(source.clicked ?? source.clickedRows ?? 0),
    confirmed: Number(source.confirmed ?? source.confirmedRows ?? 0),
    undeliverable: Number(source.undeliverable ?? source.undeliverableRows ?? 0),
    risky: Number(source.risky ?? source.riskyRows ?? 0),
    catchAll: Number(source.catchAll ?? source.catchAllRows ?? 0),
    pending: Number(source.pending ?? source.pendingRows ?? 0),
    failed: Number(source.failed ?? source.failedRows ?? 0),
  };
}

function statusLabel(value = '') {
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function authorization(accessToken) {
  return accessToken ? { 'X-Email-Job-Token': accessToken } : {};
}

function SummaryGrid({ summary }) {
  return (
    <dl className="bulk-verifier__summary-grid" aria-label="Job summary">
      {SUMMARY_ITEMS.map(([key, label, tone]) => (
        <div className={`bulk-verifier__summary-item is-${tone}`} key={key}>
          <dt>{label}</dt>
          <dd>{Number(summary?.[key] || 0).toLocaleString()}</dd>
        </div>
      ))}
    </dl>
  );
}

function FilePreview({ rows, columns }) {
  if (!rows?.length) return null;
  const visibleColumns = (columns?.length ? columns : Object.keys(rows[0] || {})).slice(0, 6);

  return (
    <div className="bulk-verifier__preview">
      <div className="bulk-verifier__section-title">
        <div>
          <span className="email-verifier__eyebrow">First 20 rows</span>
          <h3>File preview</h3>
        </div>
        <span>{rows.length} shown</span>
      </div>
      <div className="bulk-verifier__table-scroll" tabIndex="0" aria-label="Uploaded file preview">
        <table>
          <thead>
            <tr>
              <th>Row</th>
              {visibleColumns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id || row.originalRowNumber || index}>
                <td>{row.originalRowNumber || row.rowNumber || index + 2}</td>
                {visibleColumns.map((column) => (
                  <td key={column}>{String(row[column] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultDetail({ row, onClose }) {
  if (!row) return null;
  const fields = [
    ['Technical', row.technicalStatus],
    ['Delivery', row.deliveryStatus],
    ['Engagement', row.engagementStatus],
    ['Confirmation', row.confirmationStatus],
    ['Confidence', row.confidenceScore == null ? null : `${row.confidenceScore}/100`],
    ['Domain', row.domain],
    ['SMTP', row.smtpStatus],
    ['Latest event', row.latestEvent],
    ['Reason', row.reason],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');

  return (
    <aside className="bulk-verifier__detail" aria-labelledby="bulk-row-detail-title">
      <div className="bulk-verifier__detail-head">
        <div>
          <span className="email-verifier__eyebrow">Row details</span>
          <h3 id="bulk-row-detail-title">{row.email || row.normalizedEmail}</h3>
        </div>
        <button type="button" className="bulk-verifier__icon-button" onClick={onClose} aria-label="Close details">
          <X size={18} />
        </button>
      </div>
      <dl>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{statusLabel(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="bulk-verifier__tracking-note">
        Open tracking is an estimate. Some email clients block tracking images, while privacy
        features may generate automatic opens. A secure confirmation-link click remains the
        strongest proof.
      </p>
    </aside>
  );
}

export default function BulkEmailVerifier() {
  const [bulkMode, setBulkMode] = useState('instant');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [upload, setUpload] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState('');
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [job, setJob] = useState(null);
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedRow, setSelectedRow] = useState(null);
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const fileInputRef = useRef(null);
  const pollingTimerRef = useRef(null);
  const pollingIdRef = useRef(0);
  const startIdempotencyRef = useRef(crypto.randomUUID());

  const accessToken = upload?.accessToken;
  const jobId = upload?.jobId || job?.jobId;

  useEffect(
    () => () => {
      pollingIdRef.current += 1;
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (jobId && accessToken) {
      sessionStorage.setItem(`emailVerifierBulk:${jobId}`, accessToken);
    }
  }, [jobId, accessToken]);

  const resetWorkflow = useCallback(() => {
    pollingIdRef.current += 1;
    if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    setFile(null);
    setUpload(null);
    setSelectedColumn('');
    setConsent(false);
    setTurnstileToken('');
    setJob(null);
    setResults([]);
    setPagination({ page: 1, totalPages: 1, total: 0 });
    setFilters(EMPTY_FILTERS);
    setSelectedRow(null);
    setError('');
    setBusyAction('');
    startIdempotencyRef.current = crypto.randomUUID();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const chooseMode = (nextMode) => {
    if (nextMode === bulkMode) return;
    resetWorkflow();
    setBulkMode(nextMode);
  };

  const validateFile = (nextFile) => {
    if (!nextFile) return;
    const extension = getExtension(nextFile.name);
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setError('Choose an .xlsx, .xls, or .csv file.');
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setError('The selected file exceeds the 10 MB upload limit.');
      return;
    }
    setError('');
    setFile(nextFile);
    setUpload(null);
    setJob(null);
    setResults([]);
  };

  const uploadFile = async (emailColumn = '') => {
    if (!file) return;
    setBusyAction('upload');
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', bulkMode === 'confirm' ? 'confirm_by_email' : 'instant');
    formData.append('idempotencyKey', crypto.randomUUID());
    if (emailColumn) formData.append('emailColumn', emailColumn);

    try {
      const response = normalizeUpload(
        await apiFetch('/api/email-verifier/bulk/upload', {
          method: 'POST',
          body: formData,
        }),
      );
      setUpload(response);
      setSelectedColumn(response.selectedColumn || (response.columns.length === 1 ? response.columns[0] : ''));
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setBusyAction('');
    }
  };

  const fetchResults = useCallback(
    async (page = 1, nextFilters = filters) => {
      if (!jobId || !accessToken) return;
      setBusyAction('results');
      const query = new URLSearchParams({ page: String(page), pageSize: '25' });
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value) query.set(key, value);
      });
      try {
        const response = await apiFetch(
          `/api/email-verifier/bulk/${encodeURIComponent(jobId)}/results?${query}`,
          { headers: authorization(accessToken) },
        );
        const rows = response.results || response.rows || response.items || [];
        if (response.summary) setJob(normalizeStatus(response.summary));
        setResults(rows);
        setPagination({
          page: Number(response.page || response.pagination?.page || page),
          totalPages: Number(response.totalPages || response.pagination?.totalPages || 1),
          total: Number(response.total || response.pagination?.total || rows.length),
        });
      } catch (resultsError) {
        setError(resultsError.message);
      } finally {
        setBusyAction('');
      }
    },
    [accessToken, filters, jobId],
  );

  const pollJob = useCallback(() => {
    if (!jobId || !accessToken) return;
    const pollId = pollingIdRef.current + 1;
    pollingIdRef.current = pollId;

    const poll = async () => {
      if (pollingIdRef.current !== pollId) return;
      try {
        const status = normalizeStatus(
          await apiFetch(`/api/email-verifier/bulk/${encodeURIComponent(jobId)}/status`, {
            headers: authorization(accessToken),
          }),
        );
        if (pollingIdRef.current !== pollId) return;
        setJob(status);
        if (status.processed > 0) fetchResults(1, filters);
        if (TERMINAL_JOB_STATUSES.has(status.status)) {
          if (status.status === 'completed') await fetchResults(1, EMPTY_FILTERS);
          return;
        }
        pollingTimerRef.current = setTimeout(poll, 3000);
      } catch (pollError) {
        if (pollingIdRef.current !== pollId) return;
        setError(pollError.message);
      }
    };
    poll();
  }, [accessToken, fetchResults, filters, jobId]);

  const startJob = async () => {
    if (!jobId || !accessToken) return;
    const needsChallenge = bulkMode === 'confirm' || upload.turnstileRequired;
    if (needsChallenge && !turnstileToken) return;
    if (bulkMode === 'confirm' && !consent) return;
    setBusyAction('start');
    setError('');
    try {
      const response = normalizeStatus(
        await apiFetch(`/api/email-verifier/bulk/${encodeURIComponent(jobId)}/start`, {
          method: 'POST',
          headers: authorization(accessToken),
          body: JSON.stringify({
            consent: bulkMode === 'confirm',
            turnstileToken: turnstileToken || undefined,
            idempotencyKey: startIdempotencyRef.current,
          }),
        }),
      );
      setJob(response);
      setTurnstileToken('');
      setTurnstileResetKey((key) => key + 1);
      pollJob();
    } catch (startError) {
      setError(startError.message);
      if (startError.code === 'TURNSTILE_REQUIRED') {
        setUpload((current) => ({ ...current, turnstileRequired: true }));
      }
    } finally {
      setBusyAction('');
    }
  };

  const mutateJob = async (action, method) => {
    if (!jobId || !accessToken) return;
    if (
      action === 'delete' &&
      !window.confirm('Delete this job and all of its stored verification results?')
    ) {
      return;
    }
    setBusyAction(action);
    setError('');
    try {
      await apiFetch(`/api/email-verifier/bulk/${encodeURIComponent(jobId)}${action === 'cancel' ? '/cancel' : ''}`, {
        method,
        headers: authorization(accessToken),
      });
      pollingIdRef.current += 1;
      if (action === 'delete') {
        sessionStorage.removeItem(`emailVerifierBulk:${jobId}`);
        resetWorkflow();
      } else {
        setJob((current) => ({ ...current, status: 'cancelled' }));
      }
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyAction('');
    }
  };

  const downloadFile = async (kind) => {
    const endpoint =
      kind === 'template'
        ? '/api/email-verifier/template.xlsx'
        : `/api/email-verifier/bulk/${encodeURIComponent(jobId)}/export.${kind}`;
    setBusyAction(`download-${kind}`);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        credentials: 'include',
        headers: kind === 'template' ? {} : authorization(accessToken),
      });
      if (!response.ok) await parseJsonResponse(response);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download =
        kind === 'template' ? 'email-verifier-template.xlsx' : `email-verification-results.${kind}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(downloadError.message);
    } finally {
      setBusyAction('');
    }
  };

  const updateFilters = (next) => {
    const merged = { ...filters, ...next };
    setFilters(merged);
    fetchResults(1, merged);
  };

  const reviewReady = upload && !upload.needsColumn;
  const challengeRequired = bulkMode === 'confirm' || upload?.turnstileRequired;
  const canStart =
    reviewReady &&
    !job &&
    (!challengeRequired || turnstileToken) &&
    (bulkMode !== 'confirm' || consent);
  const isActive = ACTIVE_JOB_STATUSES.has(job?.status);
  const isFinished = TERMINAL_JOB_STATUSES.has(job?.status);

  return (
    <div className="bulk-verifier">
      <fieldset className="bulk-verifier__submodes">
        <legend>Choose bulk workflow</legend>
        <div>
          <label className={bulkMode === 'instant' ? 'is-selected' : ''}>
            <input
              type="radio"
              name="bulk-mode"
              checked={bulkMode === 'instant'}
              onChange={() => chooseMode('instant')}
              disabled={Boolean(job)}
            />
            <FileCheck2 size={21} aria-hidden="true" />
            <span>
              <strong>Bulk Instant Check</strong>
              <small>Checks format, domain, MX records and risk signals. No email is sent.</small>
            </span>
          </label>
          <label className={bulkMode === 'confirm' ? 'is-selected' : ''}>
            <input
              type="radio"
              name="bulk-mode"
              checked={bulkMode === 'confirm'}
              onChange={() => chooseMode('confirm')}
              disabled={Boolean(job)}
            />
            <Send size={21} aria-hidden="true" />
            <span>
              <strong>Bulk Confirm by Email</strong>
              <small>Sends one permission-based confirmation email to each approved address.</small>
            </span>
          </label>
        </div>
      </fieldset>

      {!job && (
        <section className="bulk-verifier__stage" aria-labelledby="bulk-upload-title">
          <div className="bulk-verifier__stage-index">01</div>
          <div className="bulk-verifier__stage-content">
            <div className="bulk-verifier__section-title">
              <div>
                <span className="email-verifier__eyebrow">Upload &amp; review</span>
                <h2 id="bulk-upload-title">Prepare your email list</h2>
              </div>
              <span>.XLSX · .XLS · .CSV · 10 MB</span>
            </div>

            {!file ? (
              <div
                className={`bulk-verifier__dropzone ${isDragging ? 'is-dragging' : ''}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  validateFile(event.dataTransfer.files[0]);
                }}
              >
                <UploadCloud size={34} aria-hidden="true" />
                <div>
                  <strong>Drop a spreadsheet here</strong>
                  <p>Your file is parsed for review. Uploading never sends an email.</p>
                </div>
                <div className="bulk-verifier__drop-actions">
                  <button type="button" className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                    Browse File
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => downloadFile('template')}>
                    <Download size={17} /> Download Sample Template
                  </button>
                </div>
              </div>
            ) : (
              <div className="bulk-verifier__file">
                <span className="bulk-verifier__file-icon">
                  <FileSpreadsheet size={26} />
                </span>
                <div>
                  <strong>{file.name}</strong>
                  <small>{(file.size / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB</small>
                </div>
                <button type="button" className="btn-secondary" onClick={resetWorkflow}>
                  <X size={16} /> Remove
                </button>
                {!upload && (
                  <button type="button" className="btn-primary" onClick={() => uploadFile()} disabled={busyAction === 'upload'}>
                    {busyAction === 'upload' ? <Loader2 className="email-verifier__spinner" size={18} /> : <FileCheck2 size={18} />}
                    Review file
                  </button>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              className="bulk-verifier__file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(event) => validateFile(event.target.files[0])}
            />

            {upload?.needsColumn && (
              <div className="bulk-verifier__column">
                <label htmlFor="bulk-email-column">Select the email column</label>
                <p>The server could not identify one unambiguous email column.</p>
                <div>
                  <select
                    id="bulk-email-column"
                    value={selectedColumn}
                    onChange={(event) => setSelectedColumn(event.target.value)}
                  >
                    <option value="">Choose a column</option>
                    {upload.columns.map((column) => (
                      <option value={column} key={column}>{column}</option>
                    ))}
                  </select>
                  <button type="button" className="btn-primary" disabled={!selectedColumn || busyAction === 'upload'} onClick={() => uploadFile(selectedColumn)}>
                    Apply column
                  </button>
                </div>
              </div>
            )}

            {reviewReady && (
              <>
                <dl className="bulk-verifier__review-counts">
                  <div><dt>Total rows</dt><dd>{upload.summary.total.toLocaleString()}</dd></div>
                  <div className="is-success"><dt>Valid rows</dt><dd>{upload.summary.valid.toLocaleString()}</dd></div>
                  <div className="is-danger"><dt>Invalid rows</dt><dd>{upload.summary.invalid.toLocaleString()}</dd></div>
                  <div className="is-warning"><dt>Duplicates removed</dt><dd>{upload.summary.duplicates.toLocaleString()}</dd></div>
                </dl>
                <FilePreview rows={upload.preview} columns={upload.columns} />
              </>
            )}
          </div>
        </section>
      )}

      {reviewReady && !job && (
        <section className="bulk-verifier__stage" aria-labelledby="bulk-start-title">
          <div className="bulk-verifier__stage-index">02</div>
          <div className="bulk-verifier__stage-content">
            <span className="email-verifier__eyebrow">Final approval</span>
            <h2 id="bulk-start-title">Start verification</h2>

            {bulkMode === 'confirm' && (
              <div className="bulk-verifier__send-safety">
                <div className="bulk-verifier__warning">
                  <ShieldAlert size={21} />
                  <p>
                    Do not upload scraped, purchased or unsolicited email lists. High bounce or
                    complaint rates can damage the sender domain.
                  </p>
                </div>
                <label className="email-verifier__consent">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                  <span className="email-verifier__checkbox"><Check size={15} /></span>
                  <span>
                    I confirm that I own these email addresses or have permission to send a
                    one-time verification message to them.
                  </span>
                </label>
              </div>
            )}

            {challengeRequired && (
              <TurnstileWidget
                siteKey={TURNSTILE_SITE_KEY}
                action={bulkMode === 'confirm' ? 'email_verifier_bulk_send' : 'email_verifier_bulk_instant'}
                onVerify={setTurnstileToken}
                onError={setError}
                resetKey={turnstileResetKey}
              />
            )}

            <div className="bulk-verifier__start-row">
              <div>
                <strong>{upload.summary.valid.toLocaleString()} valid addresses ready</strong>
                <small>{bulkMode === 'instant' ? 'No messages will be sent.' : 'One fixed verification message per approved address.'}</small>
              </div>
              <button type="button" className="btn-primary" disabled={!canStart || busyAction === 'start'} onClick={startJob}>
                {busyAction === 'start' ? <Loader2 className="email-verifier__spinner" size={18} /> : <BarChart3 size={18} />}
                Start Verification
              </button>
            </div>
          </div>
        </section>
      )}

      {job && (
        <section className="bulk-verifier__command" aria-labelledby="bulk-job-title">
          <div className="bulk-verifier__pulse">
            <div>
              <span className="email-verifier__eyebrow">Live job pulse</span>
              <h2 id="bulk-job-title">{statusLabel(job.status)}</h2>
            </div>
            <div className="bulk-verifier__pulse-number">{Math.round(job.percentage || 0)}%</div>
            <div
              className="bulk-verifier__progress"
              role="progressbar"
              aria-label="Verification progress"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={Math.round(job.percentage || 0)}
            >
              <span style={{ width: `${job.percentage || 0}%` }} />
            </div>
            <p>{job.processed.toLocaleString()} of {job.total.toLocaleString()} processed</p>
            {job.latestEventAt && (
              <p>Latest event: {new Date(job.latestEventAt).toLocaleString()}</p>
            )}
            {isActive && (
              <button type="button" className="btn-secondary" onClick={() => mutateJob('cancel', 'POST')} disabled={busyAction === 'cancel'}>
                <CircleStop size={17} /> Cancel
              </button>
            )}
          </div>
          <SummaryGrid summary={job} />
        </section>
      )}

      {job && (isFinished || results.length > 0) && (
        <section className="bulk-verifier__results" aria-labelledby="bulk-results-title">
          <div className="bulk-verifier__section-title">
            <div>
              <span className="email-verifier__eyebrow">Progressive results</span>
              <h2 id="bulk-results-title">Address results</h2>
            </div>
            <div className="bulk-verifier__export-actions">
              <button type="button" className="btn-secondary" onClick={() => downloadFile('xlsx')}>
                <Download size={17} /> Download Excel
              </button>
              <button type="button" className="btn-secondary" onClick={() => downloadFile('csv')}>
                <Download size={17} /> Download CSV
              </button>
              <button type="button" className="bulk-verifier__delete" onClick={() => mutateJob('delete', 'DELETE')}>
                <Trash2 size={17} /> Delete Job
              </button>
            </div>
          </div>

          <div className="bulk-verifier__filters">
            <label className="bulk-verifier__search">
              <Search size={17} />
              <span className="sr-only">Search by email</span>
              <input
                type="search"
                placeholder="Search by email"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    fetchResults(1);
                  }
                }}
              />
            </label>
            {[
              ['technicalStatus', 'All technical', ['likely_deliverable', 'undeliverable', 'risky', 'catch_all', 'unknown', 'precheck_failed']],
              ['deliveryStatus', 'All delivery', ['not_sent', 'queued', 'sending', 'sent', 'delivered', 'delayed', 'soft_bounce', 'hard_bounce', 'suppressed', 'complaint', 'failed', 'pending']],
              ['confirmationStatus', 'All confirmation', ['not_confirmed', 'confirmed_active', 'expired']],
            ].map(([key, placeholder, options]) => (
              <label className="bulk-verifier__select" key={key}>
                <Filter size={15} />
                <span className="sr-only">{placeholder}</span>
                <select value={filters[key]} onChange={(event) => updateFilters({ [key]: event.target.value })}>
                  <option value="">{placeholder}</option>
                  {options.map((option) => <option value={option} key={option}>{statusLabel(option)}</option>)}
                </select>
                <ChevronDown size={15} />
              </label>
            ))}
            <label className="bulk-verifier__select">
              <span className="sr-only">Sort confidence</span>
              <select value={filters.sort} onChange={(event) => updateFilters({ sort: event.target.value })}>
                <option value="confidence_desc">Confidence: high to low</option>
                <option value="confidence_asc">Confidence: low to high</option>
              </select>
              <ChevronDown size={15} />
            </label>
            <button type="button" className="bulk-verifier__icon-button" onClick={() => fetchResults(pagination.page)} aria-label="Refresh results">
              <RefreshCw size={17} />
            </button>
          </div>

          {busyAction === 'results' && !results.length ? (
            <div className="bulk-verifier__empty" aria-live="polite">
              <Loader2 className="email-verifier__spinner" size={24} />
              Loading real results…
            </div>
          ) : results.length ? (
            <>
              <div className="bulk-verifier__table-scroll" tabIndex="0" aria-label="Bulk verification results">
                <table className="bulk-verifier__results-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Technical</th>
                      <th>Delivery</th>
                      <th>Engagement</th>
                      <th>Confirmation</th>
                      <th>Confidence</th>
                      <th><span className="sr-only">Details</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, index) => (
                      <tr key={row.id || `${row.email}-${index}`}>
                        <td data-label="Email">{row.email || row.normalizedEmail}</td>
                        <td data-label="Technical">{statusLabel(row.technicalStatus)}</td>
                        <td data-label="Delivery">{statusLabel(row.deliveryStatus)}</td>
                        <td data-label="Engagement">{statusLabel(row.engagementStatus)}</td>
                        <td data-label="Confirmation">{statusLabel(row.confirmationStatus)}</td>
                        <td data-label="Confidence"><strong>{row.confidenceScore ?? '—'}</strong></td>
                        <td>
                          <button
                            type="button"
                            className="bulk-verifier__row-action"
                            aria-expanded={selectedRow?.id === row.id}
                            onClick={() => setSelectedRow(row)}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bulk-verifier__pagination">
                <span>{pagination.total.toLocaleString()} results</span>
                <div>
                  <button type="button" onClick={() => fetchResults(pagination.page - 1)} disabled={pagination.page <= 1} aria-label="Previous page">
                    <ChevronLeft size={18} />
                  </button>
                  <span>Page {pagination.page} of {pagination.totalPages}</span>
                  <button type="button" onClick={() => fetchResults(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} aria-label="Next page">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="bulk-verifier__empty">
              <MailCheck size={25} />
              No result rows match the current filters.
            </div>
          )}
          <ResultDetail row={selectedRow} onClose={() => setSelectedRow(null)} />
        </section>
      )}

      {error && (
        <div className="email-verifier__error" role="alert" aria-live="assertive">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

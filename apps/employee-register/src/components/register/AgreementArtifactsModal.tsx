import { ModalFrame } from './modals/ModalFrame';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

type SessionDocument = {
  id: string;
  doc_type: string;
  mime_type: string;
  created_at: string;
  has_signature: boolean;
  signature_hash_prefix?: string;
  has_pdf?: boolean;
};

export function AgreementArtifactsModal(props: {
  isOpen: boolean;
  onClose(): void;
  sessionIdLabel: string | null;
  documentsError: string | null;
  documentsLoading: boolean;
  documentsForSession: SessionDocument[] | null;
  onRefresh(): void;
  onDownloadPdf(docId: string): void;
}) {
  const {
    isOpen,
    onClose,
    sessionIdLabel,
    documentsError,
    documentsLoading,
    documentsForSession,
    onRefresh,
    onDownloadPdf,
  } = props;

  return (
    <ModalFrame
      isOpen={isOpen}
      title="Agreement artifacts"
      onClose={onClose}
      maxWidth="720px"
      maxHeight="70vh"
    >
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          Session: <span style={{ fontFamily: 'monospace' }}>{sessionIdLabel || '—'}</span>
        </div>

        {documentsError && (
          <div
            style={{
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.18)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 12,
              color: '#fecaca',
              fontWeight: 700,
            }}
          >
            {documentsError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="secondary" disabled={documentsLoading || !sessionIdLabel} onClick={onRefresh}>
            {documentsLoading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>

        {documentsForSession === null ? (
          <div style={{ color: '#94a3b8' }}>No data loaded yet.</div>
        ) : documentsForSession.length === 0 ? (
          <div style={{ color: '#94a3b8' }}>No documents found for this session.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {documentsForSession.map((doc) => (
              <Card
                key={doc.id}
                padding="md"
                className="grid gap-1 bg-slate-900/70 text-white ring-slate-700"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 900 }}>
                    {doc.doc_type}{' '}
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#94a3b8' }}>
                      {doc.id}
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8' }}>{new Date(doc.created_at).toLocaleString()}</div>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                  PDF stored: {doc.has_pdf ? 'yes' : 'no'} • Signature stored: {doc.has_signature ? 'yes' : 'no'}
                  {doc.signature_hash_prefix ? ` • sig hash: ${doc.signature_hash_prefix}…` : ''}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button disabled={!doc.has_pdf} onClick={() => onDownloadPdf(doc.id)}>
                    Download PDF
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ModalFrame>
  );
}


import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

export function CustomerInfoPanel(props: {
  customerName: string;
  customerPrimaryLanguage?: string | null;
  customerDobMonthDay?: string | null;
  customerLastVisitAt?: string | null;
  pastDueBalance: number;
  customerNotes?: string | null;
  onAddNote(): void;
}) {
  const {
    customerName,
    customerPrimaryLanguage,
    customerDobMonthDay,
    customerLastVisitAt,
    pastDueBalance,
    customerNotes,
    onAddNote,
  } = props;

  return (
    <Card className="mb-4 bg-slate-900/70 text-white ring-slate-700">
      <h2 className="er-text-lg" style={{ marginBottom: '1rem', fontWeight: 600 }}>
        Customer Information
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <div>
          <div className="er-text-sm" style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>
            Name
          </div>
          <div className="er-text-md" style={{ fontWeight: 600 }}>
            {customerName}
          </div>
        </div>
        {customerPrimaryLanguage && (
          <div>
            <div className="er-text-sm" style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>
              Primary Language
            </div>
            <div className="er-text-md" style={{ fontWeight: 600 }}>
              {customerPrimaryLanguage}
            </div>
          </div>
        )}
        {customerDobMonthDay && (
          <div>
            <div className="er-text-sm" style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>
              Date of Birth
            </div>
            <div className="er-text-md" style={{ fontWeight: 600 }}>
              {customerDobMonthDay}
            </div>
          </div>
        )}
        {customerLastVisitAt && (
          <div>
            <div className="er-text-sm" style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>
              Last Visit
            </div>
            <div className="er-text-md" style={{ fontWeight: 600 }}>
              {new Date(customerLastVisitAt).toLocaleDateString()}
            </div>
          </div>
        )}
        {pastDueBalance > 0 && (
          <div>
            <div className="er-text-sm" style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>
              Past Due Balance
            </div>
            <div
              className="er-text-md"
              style={{
                fontWeight: 600,
                color: pastDueBalance > 0 ? '#f59e0b' : 'inherit',
              }}
            >
              ${pastDueBalance.toFixed(2)}
            </div>
          </div>
        )}
      </div>
      {customerNotes && (
        <div
          style={{
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #475569',
          }}
        >
          <div className="er-text-sm" style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>
            Notes
          </div>
          <div
            className="er-text-sm"
            style={{
              padding: '0.75rem',
              background: '#0f172a',
              borderRadius: '6px',
              whiteSpace: 'pre-wrap',
              maxHeight: '150px',
              overflowY: 'auto',
            }}
          >
            {customerNotes}
          </div>
        </div>
      )}
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <Button variant="secondary" onClick={onAddNote} className="er-text-sm">
          Add Note
        </Button>
      </div>
    </Card>
  );
}


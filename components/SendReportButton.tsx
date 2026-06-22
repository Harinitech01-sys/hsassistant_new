'use client';

import { useState } from 'react';

export default function SendReportButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const triggerEmail = async () => {
    setStatus('loading');
    setMessage('Generating PDF and sending email...');

    try {
      // We hit the exact same route the automated timer uses!
      // Note: In production, it's better to pass the secret securely, 
      // but for testing, you can hardcode your CRON_SECRET here.
      const secret = "Tny8u7hjngUW7c5u5I661GBdUfkMyc4bZafllTNZyCs=";
      const response = await fetch(`/api/cron?secret=${secret}`, {
        method: 'GET',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setMessage(`Success! ${data.metrics.passed} checks passed, ${data.metrics.failed} failed.`);
        
        // Reset the button after 5 seconds
        setTimeout(() => setStatus('idle'), 5000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to send the report.');
      }
    } catch (error) {
      console.error('Error triggering report:', error);
      setStatus('error');
      setMessage('A network error occurred.');
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={triggerEmail}
        disabled={status === 'loading'}
        style={{
          backgroundColor: status === 'success' ? '#10B981' : status === 'error' ? '#EF4444' : '#0EA5E9',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '6px',
          fontWeight: 'bold',
          border: 'none',
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          opacity: status === 'loading' ? 0.7 : 1,
          transition: 'background-color 0.3s ease',
        }}
      >
        {status === 'idle' && '📩 Email Admin Now'}
        {status === 'loading' && '⏳ Processing...'}
        {status === 'success' && '✅ Email Sent!'}
        {status === 'error' && '❌ Try Again'}
      </button>
      
      {/* Status Message */}
      {status !== 'idle' && (
        <p style={{ fontSize: '14px', color: status === 'error' ? '#EF4444' : '#64748B' }}>
          {message}
        </p>
      )}
    </div>
  );
}
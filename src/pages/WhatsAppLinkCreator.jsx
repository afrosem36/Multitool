import React, { useEffect, useState } from 'react';
import {
  Clipboard,
  ExternalLink,
  Link as LinkIcon,
  MessageCircle,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import './WhatsAppLinkCreator.css';

const normalizePhoneNumber = (value) => value.replace(/\D/g, '');

const buildWhatsAppLink = (rawPhoneNumber, message) => {
  const normalizedPhoneNumber = normalizePhoneNumber(rawPhoneNumber);

  if (!normalizedPhoneNumber) {
    return {
      link: '',
      error: ''
    };
  }

  if (normalizedPhoneNumber.length < 8 || normalizedPhoneNumber.length > 15) {
    return {
      link: '',
      error: 'Enter a valid phone number with country code.'
    };
  }

  const baseUrl = `https://wa.me/${normalizedPhoneNumber}`;

  return {
    link: message.trim()
      ? `${baseUrl}?text=${encodeURIComponent(message)}`
      : baseUrl,
    error: ''
  };
};

const WhatsAppLinkCreator = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const { link, error } = buildWhatsAppLink(phoneNumber, message);
    setGeneratedLink(link);
    setErrorMessage(error);
  }, [message, phoneNumber]);

  const handleSample = () => {
    setPhoneNumber('+1 (415) 555-2671');
    setMessage('Hello! I found your link and wanted to connect on WhatsApp.');
    setStatusMessage('Sample data loaded.');
    setErrorMessage('');
  };

  const handleReset = () => {
    setPhoneNumber('');
    setMessage('');
    setGeneratedLink('');
    setErrorMessage('');
    setStatusMessage('Form cleared.');
  };

  const handleCopyLink = async () => {
    if (!generatedLink) {
      setStatusMessage('');
      setErrorMessage('Enter a valid phone number to create a WhatsApp link.');
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedLink);
      setStatusMessage('WhatsApp link copied to clipboard.');
      setErrorMessage('');
    } catch (error) {
      console.error(error);
      setStatusMessage('');
      setErrorMessage('Clipboard access is not available in this browser.');
    }
  };

  const handleOpenLink = () => {
    if (!generatedLink) {
      setStatusMessage('');
      setErrorMessage('Enter a valid phone number to open WhatsApp.');
      return;
    }

    window.open(generatedLink, '_blank', 'noopener,noreferrer');
    setStatusMessage('Opened WhatsApp link in a new tab.');
    setErrorMessage('');
  };

  return (
    <div className="whatsapp-page">
      <div className="whatsapp-hero glass-panel animate-fade-in">
        <div>
          <p className="whatsapp-kicker">Link Creator</p>
          <h1>WhatsApp Link Creator</h1>
          <p>Create a shareable WhatsApp URL that opens a chat and fills in the message automatically.</p>
        </div>

        <div className="whatsapp-hero-actions">
          <button className="btn-secondary" onClick={handleSample}>
            <Sparkles size={16} />
            Sample
          </button>
          <button className="btn-secondary" onClick={handleReset}>
            <RotateCcw size={16} />
            New
          </button>
          <button className="btn-primary" onClick={handleOpenLink}>
            <ExternalLink size={16} />
            Open WhatsApp
          </button>
        </div>
      </div>

      <div className="whatsapp-shell glass-panel animate-fade-in">
        <div className="whatsapp-grid">
          <div className="whatsapp-form">
            <label className="whatsapp-field">
              <span>User Number</span>
              <input
                type="text"
                value={phoneNumber}
                onChange={(event) => {
                  setPhoneNumber(event.target.value);
                  setStatusMessage('');
                }}
                placeholder="Enter number with country code, for example +1 415 555 2671"
              />
              <small>Use the full WhatsApp number including country code.</small>
            </label>

            <label className="whatsapp-field">
              <span>Message</span>
              <textarea
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setStatusMessage('');
                }}
                placeholder="Type the message that should appear automatically"
              />
            </label>
          </div>

          <div className="whatsapp-preview">
            <div className="whatsapp-preview-card">
              <div className="whatsapp-preview-header">
                <MessageCircle size={18} />
                <span>Generated Link</span>
              </div>

              <div className="whatsapp-link-box">
                {generatedLink || 'Your WhatsApp link will appear here'}
              </div>

              <div className="whatsapp-preview-meta">
                <div>
                  <strong>Normalized Number</strong>
                  <span>{normalizePhoneNumber(phoneNumber) || 'Waiting for input'}</span>
                </div>
                <div>
                  <strong>Message Length</strong>
                  <span>{message.length} characters</span>
                </div>
              </div>
            </div>

            <div className="whatsapp-preview-card">
              <div className="whatsapp-preview-header">
                <LinkIcon size={18} />
                <span>How It Works</span>
              </div>
              <p>
                Anyone who clicks this link will be redirected to WhatsApp with your number selected and your
                message pre-filled automatically.
              </p>
            </div>
          </div>
        </div>

        {(statusMessage || errorMessage) && (
          <div className={`whatsapp-message ${errorMessage ? 'error' : 'success'}`}>
            {errorMessage || statusMessage}
          </div>
        )}

        <div className="whatsapp-footer-actions">
          <button className="btn-secondary" onClick={handleCopyLink}>
            <Clipboard size={16} />
            Copy Link
          </button>
          <button className="btn-primary" onClick={handleOpenLink}>
            <ExternalLink size={16} />
            Open WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppLinkCreator;

import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import {
  Clipboard,
  Download,
  FileUp,
  Link as LinkIcon,
  RotateCcw,
  Sparkles,
  Trash2
} from 'lucide-react';
import { findTextToolById } from '../data/toolCatalog';
import RelatedTools from '../components/shared/RelatedTools';
import AffiliatePlaceholder from '../components/shared/AffiliatePlaceholder';
import './TextToolPage.css';

const RANDOM_WORD_BANK = [
  'amber', 'atlas', 'breeze', 'cinder', 'comet', 'delta', 'echo', 'ember',
  'fern', 'glimmer', 'harbor', 'iris', 'juniper', 'lagoon', 'linen', 'meadow',
  'nova', 'orbit', 'pixel', 'quartz', 'ripple', 'summit', 'thunder', 'velvet',
  'wander', 'willow', 'zephyr'
];

const RANDOM_EMOJI_BANK = [
  '😀', '🎉', '🚀', '🔥', '✨', '🌈', '🎯', '💡', '🍀', '🌊',
  '📚', '🧠', '🎵', '⭐', '🍕', '☕', '🛠️', '🌙', '🎨', '💎'
];

const clampValue = (value, min, max) => Math.min(Math.max(value, min), max);

const buildSeparator = (separatorMode) => {
  switch (separatorMode) {
    case 'newline':
      return '\n';
    case 'comma':
      return ', ';
    case 'none':
      return '';
    default:
      return ' ';
  }
};

const countLines = (value) => {
  if (!value) {
    return 0;
  }

  return value.split(/\r?\n/).length;
};

const getDefaultSettings = (toolId) => {
  switch (toolId) {
    case 'random-password-generator':
      return {
        passwordLength: 16,
        includeLowercase: true,
        includeUppercase: true,
        includeNumbers: true,
        includeSymbols: true
      };
    case 'random-words':
      return {
        wordCount: 8,
        separator: 'space',
        capitalizeWords: false
      };
    case 'random-emoji':
      return {
        emojiCount: 8,
        separator: 'space'
      };
    case 'word-repeater':
      return {
        repeatCount: 6,
        separator: 'space'
      };
    default:
      return {};
  }
};

const toolNeedsSourceText = (toolId) =>
  !['random-password-generator', 'random-words', 'random-emoji'].includes(toolId);

const toolSupportsExternalInput = (toolId) =>
  !['random-password-generator', 'random-words', 'random-emoji'].includes(toolId);

const getInputLabel = (toolId) =>
  toolId === 'word-repeater' ? 'Word or Phrase' : 'Input Text';

const getInputPlaceholder = (tool) => {
  switch (tool.id) {
    case 'word-repeater':
      return 'Enter the word or phrase to repeat';
    default:
      return `Enter text to ${tool.name.toLowerCase()}`;
  }
};

const getOutputPlaceholder = (tool) => {
  switch (tool.id) {
    case 'random-password-generator':
      return 'Generated password';
    case 'random-words':
      return 'Generated random words';
    case 'random-emoji':
      return 'Generated random emoji';
    case 'word-repeater':
      return 'Repeated words';
    default:
      return `${tool.name} result`;
  }
};

const runTextTool = (toolId, sourceText, filterValue = '', settings = {}) => {
  if (!sourceText && toolNeedsSourceText(toolId)) {
    return {
      result: '',
      error: ''
    };
  }

  switch (toolId) {
    case 'remove-punctuation':
      return {
        result: sourceText.replace(/[^\p{L}\p{N}\s]/gu, ''),
        error: ''
      };
    case 'remove-accents':
      return {
        result: sourceText.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        error: ''
      };
    case 'remove-duplicate-lines': {
      const seen = new Set();
      const lines = sourceText.split(/\r?\n/);
      const uniqueLines = lines.filter((line) => {
        if (seen.has(line)) {
          return false;
        }

        seen.add(line);
        return true;
      });

      return {
        result: uniqueLines.join('\n'),
        error: ''
      };
    }
    case 'remove-empty-lines':
      return {
        result: sourceText
          .split(/\r?\n/)
          .filter((line) => line.trim() !== '')
          .join('\n'),
        error: ''
      };
    case 'remove-line-breaks':
      return {
        result: sourceText.replace(/\s*\r?\n+\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim(),
        error: ''
      };
    case 'remove-extra-spaces':
      return {
        result: sourceText
          .split(/\r?\n/)
          .map((line) => line.trim().replace(/[ \t]+/g, ' '))
          .join('\n'),
        error: ''
      };
    case 'remove-whitespace':
      return {
        result: sourceText.replace(/\s+/g, ''),
        error: ''
      };
    case 'remove-lines-containing': {
      if (!filterValue.trim()) {
        return {
          result: '',
          error: 'Enter a word or phrase to remove matching lines.'
        };
      }

      const query = filterValue.toLowerCase();

      return {
        result: sourceText
          .split(/\r?\n/)
          .filter((line) => !line.toLowerCase().includes(query))
          .join('\n'),
        error: ''
      };
    }
    case 'random-password-generator': {
      const length = clampValue(Number(settings.passwordLength) || 16, 4, 64);
      const pools = [];

      if (settings.includeLowercase) {
        pools.push('abcdefghijklmnopqrstuvwxyz');
      }
      if (settings.includeUppercase) {
        pools.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      }
      if (settings.includeNumbers) {
        pools.push('0123456789');
      }
      if (settings.includeSymbols) {
        pools.push('!@#$%^&*()-_=+[]{};:,.?/|');
      }

      if (pools.length === 0) {
        return {
          result: '',
          error: 'Select at least one character group for the password.'
        };
      }

      const pool = pools.join('');
      const password = Array.from({ length }, () =>
        pool[Math.floor(Math.random() * pool.length)]
      ).join('');

      return {
        result: password,
        error: ''
      };
    }
    case 'random-words': {
      const count = clampValue(Number(settings.wordCount) || 8, 1, 50);
      const separator = buildSeparator(settings.separator);
      const words = Array.from({ length: count }, () => {
        const selectedWord = RANDOM_WORD_BANK[Math.floor(Math.random() * RANDOM_WORD_BANK.length)];

        return settings.capitalizeWords
          ? `${selectedWord.charAt(0).toUpperCase()}${selectedWord.slice(1)}`
          : selectedWord;
      });

      return {
        result: words.join(separator),
        error: ''
      };
    }
    case 'random-emoji': {
      const count = clampValue(Number(settings.emojiCount) || 8, 1, 50);
      const separator = buildSeparator(settings.separator);
      const emojiList = Array.from({ length: count }, () =>
        RANDOM_EMOJI_BANK[Math.floor(Math.random() * RANDOM_EMOJI_BANK.length)]
      );

      return {
        result: emojiList.join(separator),
        error: ''
      };
    }
    case 'word-repeater': {
      if (!sourceText.trim()) {
        return {
          result: '',
          error: 'Enter a word or phrase to repeat.'
        };
      }

      const repeatCount = clampValue(Number(settings.repeatCount) || 1, 1, 100);
      const separator = buildSeparator(settings.separator);

      return {
        result: Array.from({ length: repeatCount }, () => sourceText).join(separator),
        error: ''
      };
    }
    default:
      return {
        result: sourceText,
        error: ''
      };
  }
};

const TextToolPage = () => {
  const { toolId } = useParams();
  const tool = findTextToolById(toolId);
  const fileInputRef = useRef(null);
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [settings, setSettings] = useState(() => getDefaultSettings(toolId));
  const [autoRun, setAutoRun] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setInputText('');
    setOutputText('');
    setFilterValue('');
    setSettings(getDefaultSettings(toolId));
    setStatusMessage('');
    setErrorMessage('');
    setAutoRun(true);
  }, [toolId]);

  useEffect(() => {
    if (!autoRun) {
      return;
    }

    const { result, error } = runTextTool(toolId, inputText, filterValue, settings);
    setOutputText(result);
    setErrorMessage(error);
  }, [autoRun, filterValue, inputText, settings, toolId]);

  if (!tool) {
    return <Navigate to="/" replace />;
  }

  const updateSetting = (key, value) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      [key]: value
    }));
    setStatusMessage('');
  };

  const handleRunTool = () => {
    const { result, error } = runTextTool(toolId, inputText, filterValue, settings);
    setOutputText(result);
    setErrorMessage(error);
    setStatusMessage(error ? '' : `${tool.name} completed.`);
  };

  const handleSample = () => {
    setInputText(tool.sampleInput);
    setFilterValue(toolId === 'remove-lines-containing' ? 'remove' : '');

    if (toolId === 'random-password-generator') {
      setSettings({
        passwordLength: 20,
        includeLowercase: true,
        includeUppercase: true,
        includeNumbers: true,
        includeSymbols: true
      });
    } else if (toolId === 'random-words') {
      setSettings({
        wordCount: 12,
        separator: 'space',
        capitalizeWords: true
      });
    } else if (toolId === 'random-emoji') {
      setSettings({
        emojiCount: 10,
        separator: 'space'
      });
    } else if (toolId === 'word-repeater') {
      setSettings({
        repeatCount: 8,
        separator: 'space'
      });
    } else {
      setSettings(getDefaultSettings(toolId));
    }

    setStatusMessage('Sample text loaded.');
    setErrorMessage('');
  };

  const handleReset = () => {
    setInputText('');
    setOutputText('');
    setFilterValue('');
    setSettings(getDefaultSettings(toolId));
    setStatusMessage('Workspace cleared.');
    setErrorMessage('');
  };

  const handleFileUpload = async (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    try {
      const fileContents = await selectedFile.text();
      setInputText(fileContents);
      setStatusMessage(`${selectedFile.name} loaded.`);
      setErrorMessage('');
    } catch (error) {
      console.error(error);
      setStatusMessage('');
      setErrorMessage('Could not read the selected file.');
    } finally {
      event.target.value = '';
    }
  };

  const handleLoadUrl = async () => {
    const requestedUrl = window.prompt('Enter a URL that returns plain text');

    if (!requestedUrl) {
      return;
    }

    try {
      const response = await fetch(requestedUrl);

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const remoteText = await response.text();
      setInputText(remoteText);
      setStatusMessage('Text loaded from URL.');
      setErrorMessage('');
    } catch (error) {
      console.error(error);
      setStatusMessage('');
      setErrorMessage('Could not load text from that URL. The server may block cross-origin requests.');
    }
  };

  const handleCopy = async () => {
    if (!outputText) {
      setStatusMessage('');
      setErrorMessage('There is no output text to copy yet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(outputText);
      setStatusMessage('Output copied to clipboard.');
      setErrorMessage('');
    } catch (error) {
      console.error(error);
      setStatusMessage('');
      setErrorMessage('Clipboard access is not available in this browser.');
    }
  };

  const handleDownload = () => {
    if (!outputText) {
      setStatusMessage('');
      setErrorMessage('There is no output text to download yet.');
      return;
    }

    const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tool.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatusMessage('Output downloaded.');
    setErrorMessage('');
  };

  const renderSettingsPanel = () => {
    if (toolId === 'remove-lines-containing') {
      return (
        <div className="text-tool-filter">
          <label htmlFor="text-filter">Remove lines containing</label>
          <input
            id="text-filter"
            type="text"
            value={filterValue}
            onChange={(event) => setFilterValue(event.target.value)}
            placeholder="Enter a word or phrase"
          />
        </div>
      );
    }

    if (toolId === 'random-password-generator') {
      return (
        <div className="text-tool-settings">
          <div className="settings-grid">
            <label className="settings-field">
              <span>Password Length</span>
              <input
                type="number"
                min="4"
                max="64"
                value={settings.passwordLength}
                onChange={(event) => updateSetting('passwordLength', event.target.value)}
              />
            </label>
          </div>

          <div className="settings-checkbox-grid">
            <label className="checkbox-chip">
              <input
                type="checkbox"
                checked={settings.includeLowercase}
                onChange={(event) => updateSetting('includeLowercase', event.target.checked)}
              />
              Lowercase
            </label>
            <label className="checkbox-chip">
              <input
                type="checkbox"
                checked={settings.includeUppercase}
                onChange={(event) => updateSetting('includeUppercase', event.target.checked)}
              />
              Uppercase
            </label>
            <label className="checkbox-chip">
              <input
                type="checkbox"
                checked={settings.includeNumbers}
                onChange={(event) => updateSetting('includeNumbers', event.target.checked)}
              />
              Numbers
            </label>
            <label className="checkbox-chip">
              <input
                type="checkbox"
                checked={settings.includeSymbols}
                onChange={(event) => updateSetting('includeSymbols', event.target.checked)}
              />
              Symbols
            </label>
          </div>
        </div>
      );
    }

    if (toolId === 'random-words') {
      return (
        <div className="text-tool-settings">
          <div className="settings-grid">
            <label className="settings-field">
              <span>Word Count</span>
              <input
                type="number"
                min="1"
                max="50"
                value={settings.wordCount}
                onChange={(event) => updateSetting('wordCount', event.target.value)}
              />
            </label>

            <label className="settings-field">
              <span>Separator</span>
              <select
                value={settings.separator}
                onChange={(event) => updateSetting('separator', event.target.value)}
              >
                <option value="space">Space</option>
                <option value="comma">Comma</option>
                <option value="newline">New Line</option>
              </select>
            </label>
          </div>

          <div className="settings-checkbox-grid">
            <label className="checkbox-chip">
              <input
                type="checkbox"
                checked={settings.capitalizeWords}
                onChange={(event) => updateSetting('capitalizeWords', event.target.checked)}
              />
              Capitalize Words
            </label>
          </div>
        </div>
      );
    }

    if (toolId === 'random-emoji') {
      return (
        <div className="text-tool-settings">
          <div className="settings-grid">
            <label className="settings-field">
              <span>Emoji Count</span>
              <input
                type="number"
                min="1"
                max="50"
                value={settings.emojiCount}
                onChange={(event) => updateSetting('emojiCount', event.target.value)}
              />
            </label>

            <label className="settings-field">
              <span>Separator</span>
              <select
                value={settings.separator}
                onChange={(event) => updateSetting('separator', event.target.value)}
              >
                <option value="space">Space</option>
                <option value="none">None</option>
                <option value="newline">New Line</option>
              </select>
            </label>
          </div>
        </div>
      );
    }

    if (toolId === 'word-repeater') {
      return (
        <div className="text-tool-settings">
          <div className="settings-grid">
            <label className="settings-field">
              <span>Repeat Count</span>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.repeatCount}
                onChange={(event) => updateSetting('repeatCount', event.target.value)}
              />
            </label>

            <label className="settings-field">
              <span>Separator</span>
              <select
                value={settings.separator}
                onChange={(event) => updateSetting('separator', event.target.value)}
              >
                <option value="space">Space</option>
                <option value="comma">Comma</option>
                <option value="newline">New Line</option>
              </select>
            </label>
          </div>
        </div>
      );
    }

    return null;
  };

  const showSourcePanel = toolNeedsSourceText(toolId);
  const allowExternalInput = toolSupportsExternalInput(toolId);

  return (
    <div className="text-tool-page">
      <div className="text-tool-hero glass-panel animate-fade-in">
        <div>
          <p className="text-tool-kicker">Text Tools</p>
          <h1>{tool.name}</h1>
          <p>{tool.description}</p>
        </div>

        <div className="text-tool-hero-actions">
          <button className="btn-secondary" onClick={handleSample}>
            <Sparkles size={16} />
            Sample
          </button>
          <button className="btn-secondary" onClick={handleReset}>
            <RotateCcw size={16} />
            New
          </button>
          <button className="btn-primary" onClick={handleDownload}>
            <Download size={16} />
            Save Output
          </button>
        </div>
      </div>

      <div className="text-tool-shell glass-panel animate-fade-in">
        {renderSettingsPanel()}

        <div className="text-tool-editor">
          {showSourcePanel && (
            <div className="text-panel">
              <div className="text-panel-header">
                <span>{getInputLabel(toolId)}</span>
                <div className="text-panel-actions">
                  <button onClick={handleSample}>Sample</button>
                  {allowExternalInput && (
                    <button onClick={() => fileInputRef.current?.click()}>
                      <FileUp size={14} />
                      File
                    </button>
                  )}
                  {allowExternalInput && (
                    <button onClick={handleLoadUrl}>
                      <LinkIcon size={14} />
                      Load URL
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setInputText('');
                      setStatusMessage('Input text cleared.');
                      setErrorMessage('');
                    }}
                  >
                    <Trash2 size={14} />
                    Clear
                  </button>
                </div>
              </div>

              <textarea
                value={inputText}
                onChange={(event) => {
                  setInputText(event.target.value);
                  setStatusMessage('');
                }}
                placeholder={getInputPlaceholder(tool)}
              />

              <div className="text-panel-meta">
                <span>{countLines(inputText)} lines</span>
                <span>{inputText.length} characters</span>
              </div>
            </div>
          )}

          <div className="text-tool-controls">
            <label className="auto-toggle">
              <input
                type="checkbox"
                checked={autoRun}
                onChange={(event) => setAutoRun(event.target.checked)}
              />
              Auto
            </label>

            <button className="btn-primary" onClick={handleRunTool}>
              {tool.actionLabel || tool.name}
            </button>

            {allowExternalInput && (
              <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
                <FileUp size={16} />
                File
              </button>
            )}

            {allowExternalInput && (
              <button className="btn-secondary" onClick={handleLoadUrl}>
                <LinkIcon size={16} />
                Load URL
              </button>
            )}
          </div>

          <div className="text-panel">
            <div className="text-panel-header">
              <span>Output Text</span>
              <div className="text-panel-actions">
                <button onClick={handleCopy}>
                  <Clipboard size={14} />
                  Copy
                </button>
              </div>
            </div>

            <textarea
              value={outputText}
              readOnly
              placeholder={getOutputPlaceholder(tool)}
            />

            <div className="text-panel-meta">
              <span>{countLines(outputText)} lines</span>
              <span>{outputText.length} characters</span>
            </div>
          </div>
        </div>

        {(statusMessage || errorMessage) && (
          <div className={`text-tool-message ${errorMessage ? 'error' : 'success'}`}>
            {errorMessage || statusMessage}
          </div>
        )}

        <div className="text-tool-footer-actions">
          <button className="btn-secondary" onClick={handleCopy}>
            <Clipboard size={16} />
            Copy To Clipboard
          </button>
          <button className="btn-secondary" onClick={handleDownload}>
            <Download size={16} />
            Download
          </button>
        </div>
      </div>

      <AffiliatePlaceholder 
        title="Need Advanced Text Analysis?" 
        description="Try Grammarly for real-time grammar checking, style suggestions, and advanced writing assistance."
        link="https://grammarly.com"
        cta="Try for Free"
      />

      <RelatedTools currentToolId={toolId} category="text" />

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.csv,.json,text/plain"
        className="hidden-input"
        onChange={handleFileUpload}
      />
    </div>
  );
};

export default TextToolPage;

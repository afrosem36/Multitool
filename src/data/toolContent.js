// Rich content descriptions for all tools to fix "thin content" AdSense issues
// Each tool includes: overview, benefits, use cases, tips, FAQs

export const toolContentDatabase = {
  // PDF TOOLS
  '/merge': {
    title: 'Merge PDFs',
    shortDesc: 'Combine multiple PDF files into one easily.',
    richContent: {
      overview: `
PDF merging is essential for consolidating multiple documents into a single file. Whether you're combining reports,
invoices, contracts, or scanned pages, our PDF merger lets you do it instantly in your browser without needing desktop
software.

The tool supports unlimited file uploads and maintains the original quality and formatting of each document. Simply
upload your PDFs in the desired order, and download the combined result.
      `,
      benefits: [
        'Combine up to 20+ PDF files in seconds',
        'Maintains original document quality and formatting',
        'No file size limits for most use cases',
        'Works directly in your browser - no installation needed',
        'All processing happens locally - your files stay private',
        'Free to use with no account required'
      ],
      useCases: [
        'Combining monthly reports into a yearly document',
        'Merging contract pages with signed pages',
        'Consolidating scanned pages from multiple sources',
        'Combining presentation PDFs with appendices',
        'Merging invoice batches for archival'
      ],
      howToUse: `
1. Click "Upload Files" and select multiple PDF files
2. Arrange files by dragging to reorder them
3. Click "Merge PDFs" to combine them
4. Download your merged PDF immediately
      `,
      tips: [
        'Arrange files in the correct order before merging',
        'For very large documents (100+ pages), merge in batches',
        'PDFs retain their original compression and quality',
        'Some encrypted PDFs cannot be merged - try decrypting first'
      ],
      faqItems: [
        { q: 'Can I merge encrypted PDFs?', a: 'Most encrypted PDFs cannot be merged. Try removing the password first using a PDF unlock tool.' },
        { q: 'Is there a file size limit?', a: 'There is no hard limit, but very large files may take longer to process.' },
        { q: 'Are my files stored on your server?', a: 'No. All processing happens in your browser. Files are never uploaded to any server.' },
        { q: 'Can I merge PDFs with different dimensions?', a: 'Yes, PDFs of different sizes can be merged together. They will maintain their original dimensions.' }
      ]
    }
  },

  '/split': {
    title: 'Split PDFs',
    shortDesc: 'Extract specific pages from a PDF file.',
    richContent: {
      overview: `
PDF splitting allows you to extract specific pages from a larger PDF document. This is useful when you need to
separate pages, remove unwanted sections, or distribute individual pages to different recipients.

Our split tool lets you select exactly which pages to keep and download them as a new PDF. The remaining pages
can be discarded or kept in the original file.
      `,
      benefits: [
        'Extract any page range from a PDF',
        'Remove unwanted pages instantly',
        'Create multiple PDFs from one document',
        'Preserve original quality and formatting',
        'Zero file size overhead',
        'Works on any PDF type'
      ],
      useCases: [
        'Extracting specific chapters from a book',
        'Removing blank pages or cover pages',
        'Splitting scanned documents by section',
        'Separating merged documents back to individual files',
        'Creating version-specific documents'
      ],
      howToUse: `
1. Upload your PDF file
2. Enter the page range (e.g., "1-5" or "3,7,9")
3. Click "Extract Pages"
4. Download your new PDF with only selected pages
      `,
      tips: [
        'Use comma separation for non-contiguous pages (e.g., "1,3,5")',
        'Use hyphens for page ranges (e.g., "10-20")',
        'You can specify multiple ranges (e.g., "1-5, 10-15")',
        'Original file remains unchanged'
      ],
      faqItems: [
        { q: 'Can I extract non-sequential pages?', a: 'Yes, use comma separation like "1,3,5" to extract pages 1, 3, and 5.' },
        { q: 'What if I specify invalid pages?', a: 'The tool will ignore invalid page numbers and process only valid ones.' },
        { q: 'Does splitting reduce file quality?', a: 'No, splitting maintains the original quality and compression.' },
        { q: 'Can I split password-protected PDFs?', a: 'Not without removing the password first. Use a PDF unlock tool first.' }
      ]
    }
  },

  // IMAGE TOOLS
  '/image/compress': {
    title: 'Compress Images',
    shortDesc: 'Reduce image file size while maintaining quality.',
    richContent: {
      overview: `
Image compression is essential for web optimization, email sharing, and storage efficiency. Our image compressor
intelligently reduces file size while preserving visual quality using modern compression algorithms.

Compressed images load faster on websites, consume less storage, and are easier to share via email or messaging apps.
The tool supports JPEG, PNG, WebP, and multiple image formats.
      `,
      benefits: [
        'Reduce image sizes by 50-80% without noticeable quality loss',
        'Batch process multiple images at once',
        'Maintain transparency in PNG images',
        'Automatic format detection and optimization',
        'No account or registration required',
        'Works entirely in your browser'
      ],
      useCases: [
        'Optimizing product photos for e-commerce sites',
        'Reducing website image file sizes for faster loading',
        'Compressing photos before emailing or uploading',
        'Preparing images for social media',
        'Reducing storage space on devices or cloud services'
      ],
      howToUse: `
1. Upload one or more image files
2. Adjust compression quality slider if desired
3. Click "Compress Images"
4. Download compressed images individually or as a zip
      `,
      tips: [
        'JPEG is best for photos; PNG for graphics with transparency',
        'Lower quality settings create smaller files but less detail',
        'Try quality 80-85 first as a balance between size and quality',
        'Batch processing is faster than individual uploads'
      ],
      faqItems: [
        { q: 'How much smaller will my images be?', a: 'Typically 50-80% smaller depending on original quality and image type. Exact reduction varies by image content.' },
        { q: 'Will compression reduce image quality?', a: 'Some quality loss is inevitable, but with proper settings, it\'s usually imperceptible to the human eye.' },
        { q: 'What image formats are supported?', a: 'We support JPEG, PNG, GIF, WebP, and AVIF formats.' },
        { q: 'Can I compress and convert in one step?', a: 'Yes, use our image converter which also compresses during format conversion.' }
      ]
    }
  },

  // TEXT TOOLS
  '/text-tools': {
    title: 'Text Cleanup & Formatting',
    shortDesc: 'Clean, format, and transform text effortlessly.',
    richContent: {
      overview: `
Text cleanup tools help remove unwanted characters, fix formatting issues, and standardize text copied from various
sources. Whether you're dealing with line breaks, extra spaces, or mixed formatting, our text tools solve common text
processing challenges instantly.

Common scenarios include cleaning text copied from PDFs (which often includes unwanted line breaks), removing excess
spacing, converting text case, and removing special characters.
      `,
      benefits: [
        'Remove unwanted line breaks and spaces automatically',
        'Fix text copied from PDFs that looks broken',
        'Convert between uppercase, lowercase, and title case',
        'Remove or replace special characters',
        'Count words, characters, and lines instantly',
        'Work with text of any length'
      ],
      useCases: [
        'Cleaning text scraped from websites or PDFs',
        'Fixing formatting of copied content for blogs or documents',
        'Removing extra spaces and line breaks from email signatures',
        'Preparing text for programming or data processing',
        'Standardizing text formatting across documents'
      ],
      howToUse: `
1. Paste your text into the input area
2. Select the cleanup operation you need
3. Preview the result instantly
4. Copy or download the cleaned text
      `,
      tips: [
        'Preview changes before applying them',
        'Use the "Remove Line Breaks" tool for PDF-copied text',
        'Chain multiple operations for complex transformations',
        'The tool works with any text length without lag'
      ],
      faqItems: [
        { q: 'Why does text from PDFs have weird line breaks?', a: 'PDFs store text with break points every line, causing awkward breaks when extracted.' },
        { q: 'Can I undo changes?', a: 'Yes, keep your original text and use the browser\'s back button, or just paste again.' },
        { q: 'What special characters can be removed?', a: 'All non-alphanumeric characters including symbols, punctuation, and control characters.' },
        { q: 'Is there a character limit?', a: 'No, the tool handles texts of any length limited only by your browser\'s memory.' }
      ]
    }
  },

  // UTILITY TOOLS
  '/whatsapp-link-creator': {
    title: 'WhatsApp Link Creator',
    shortDesc: 'Generate shareable WhatsApp links with prefilled messages.',
    richContent: {
      overview: `
The WhatsApp Link Creator generates direct links that open WhatsApp conversations with preset messages and phone numbers.
These links are perfect for marketing campaigns, customer support, business websites, and personal communication.

Instead of manually typing messages, recipients click a link and WhatsApp opens with your message already ready to send.
      `,
      benefits: [
        'Create direct WhatsApp links for marketing campaigns',
        'Prefill messages and phone numbers automatically',
        'No WhatsApp Business account required',
        'Works on mobile and desktop',
        'Generate unlimited links for free',
        'Easy QR code generation for links'
      ],
      useCases: [
        'Creating customer support links on business websites',
        'Marketing campaigns with direct messaging',
        'Event coordination with attendees',
        'Lead generation for services',
        'Creating order or booking links',
        'Emergency contact sharing'
      ],
      howToUse: `
1. Enter recipient phone number (with country code)
2. Type your message in the message field
3. Click "Generate Link"
4. Share the link or generate QR code
5. Recipients click link and message pre-appears
      `,
      tips: [
        'Always include country code in phone number (e.g., +1 for US)',
        'Keep messages under 160 characters for reliability',
        'Test link on your own phone before sharing widely',
        'QR codes are great for print materials'
      ],
      faqItems: [
        { q: 'Do I need WhatsApp Business?', a: 'No, regular WhatsApp accounts work fine. Business accounts add extra features but aren\'t required.' },
        { q: 'Can I include formatting in the message?', a: 'Yes, WhatsApp supports *bold*, _italic_, and ~strikethrough~ formatting.' },
        { q: 'What\'s the country code format?', a: 'Use the international format, e.g., +1 for USA, +44 for UK, +91 for India.' },
        { q: 'Can I track if someone clicked my link?', a: 'No, WhatsApp links don\'t include tracking. You\'ll see messages come in normally.' }
      ]
    }
  }
};

// Helper function to get tool content
export const getToolContent = (path) => {
  return toolContentDatabase[path] || null;
};

// Get all available tool paths
export const getAllToolPaths = () => {
  return Object.keys(toolContentDatabase);
};

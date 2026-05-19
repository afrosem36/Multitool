// Rich educational content for tool pages — fixes AdSense "thin content" issues.
// Each entry maps a route path to overview, benefits, use cases, how-to steps, tips, and FAQs.

export const toolContentDatabase = {

  // ─── PDF TOOLS ────────────────────────────────────────────────────────────────

  '/merge': {
    title: 'Merge PDFs',
    richContent: {
      overview: 'PDF merging lets you combine multiple PDF files into a single, organized document. Instead of sending several separate attachments, you can consolidate reports, contracts, invoices, and scanned pages into one clean file. This tool processes everything inside your browser so your files stay private and never touch a server.',
      benefits: [
        'Combine unlimited PDF files in seconds',
        'Maintains original quality and formatting of every page',
        'Drag-and-drop reordering before you merge',
        'Fully browser-based — no uploads to any server',
        'No account or subscription required',
        'Works on Windows, Mac, iOS, and Android browsers',
      ],
      useCases: [
        'Combining monthly reports into a single yearly archive',
        'Merging a signed contract with its supporting attachments',
        'Consolidating scanned pages from a multi-part document',
        'Building a complete job application packet from separate files',
        'Combining invoice batches for bookkeeping or audits',
      ],
      howToUse: `
1. Click "Upload Files" and select two or more PDF files.
2. Drag the file cards to set the reading order.
3. Click "Merge & Download" to combine them.
4. Your merged PDF downloads immediately.
      `,
      tips: [
        'Always check the file order before merging — reorder by dragging.',
        'For very large documents (200+ pages), merge in smaller batches first.',
        'Encrypted PDFs must be unlocked before they can be merged.',
        'Rename the downloaded file to something descriptive before sharing.',
      ],
      faqItems: [
        { q: 'Can I merge password-protected PDFs?', a: 'Not directly. Remove the password first using a PDF unlock tool, then merge.' },
        { q: 'Is there a file size limit?', a: 'There is no hard limit, but very large files may take longer depending on your device speed.' },
        { q: 'Are my files stored on your servers?', a: 'No. All merging happens entirely inside your browser. Files are never uploaded.' },
        { q: 'Can I merge PDFs of different page sizes?', a: 'Yes. Pages of different dimensions are preserved exactly as they are.' },
      ],
    },
  },

  '/split': {
    title: 'Split PDF',
    richContent: {
      overview: 'PDF splitting lets you extract specific pages from a larger document and save them as a new, smaller PDF. This is useful when you need to share only part of a report, remove a cover page, or separate chapters that were scanned together. The tool runs entirely in your browser without uploading anything.',
      benefits: [
        'Extract any single page or page range from a PDF',
        'Remove blank or unwanted pages easily',
        'Preserve original quality — no re-compression',
        'Split large documents into distributable sections',
        'Zero server uploads — complete privacy',
        'No sign-up needed',
      ],
      useCases: [
        'Extracting a specific chapter from a scanned book',
        'Removing a confidential page before sharing a report',
        'Separating a combined invoice into individual invoices',
        'Pulling out only the signature page from a contract',
        'Creating a lighter preview version of a large document',
      ],
      howToUse: `
1. Upload your PDF file.
2. Enter the page range you want to keep (e.g., "1-5" or "3,7,9").
3. Click "Extract Pages".
4. Download the new PDF containing only the selected pages.
      `,
      tips: [
        'Use commas for non-sequential pages: "1,3,5" extracts pages 1, 3, and 5.',
        'Use hyphens for ranges: "10-20" extracts ten pages at once.',
        'Combine both: "1-3,7,10-12" gives you flexible selections.',
        'The original file remains unchanged on your device.',
      ],
      faqItems: [
        { q: 'Can I extract non-consecutive pages?', a: 'Yes. Use comma-separated values such as "2,5,8" to extract pages 2, 5, and 8.' },
        { q: 'What if I enter an invalid page number?', a: 'The tool skips invalid numbers and processes only valid page references.' },
        { q: 'Does splitting reduce file quality?', a: 'No. Pages are copied at their original quality and compression.' },
        { q: 'Can I split a password-protected PDF?', a: 'No. Remove the password with an unlock tool first, then split.' },
      ],
    },
  },

  '/protect': {
    title: 'Protect PDF',
    richContent: {
      overview: 'Adding a password to a PDF prevents unauthorized access. This is important when sharing sensitive documents like payslips, medical records, financial statements, or confidential business reports. The password is applied directly in your browser using standard AES encryption, and the file is never sent to any server.',
      benefits: [
        'Encrypts your PDF with a user-defined password',
        'Uses AES encryption — the same standard used by banks',
        'File stays on your device — no server upload',
        'Prevents unauthorized opening, copying, or printing',
        'Works on all standard PDF readers',
        'Free with no account required',
      ],
      useCases: [
        'Protecting payslips or salary documents before emailing them',
        'Securing a client contract or NDA before sharing',
        'Locking confidential financial statements',
        'Protecting medical or legal records shared digitally',
        'Preventing casual access to internal business documents',
      ],
      howToUse: `
1. Upload the PDF you want to protect.
2. Enter a strong password in the password field.
3. Click "Protect & Download".
4. Share the locked PDF — recipients need the password to open it.
      `,
      tips: [
        'Use a mix of letters, numbers, and symbols for a stronger password.',
        'Store the password separately — there is no recovery if you forget it.',
        'Share the password through a different channel (e.g., call or SMS, not the same email).',
        'Test the protected PDF on a different device before sending it.',
      ],
      faqItems: [
        { q: 'Can the password be removed later?', a: 'Yes. Use a PDF unlock tool with the correct password to remove protection.' },
        { q: 'What encryption does this tool use?', a: 'Standard AES-128 or AES-256 depending on the PDF library, which is secure for most use cases.' },
        { q: 'Does the tool store my password?', a: 'No. Everything runs in the browser and nothing is logged or stored.' },
        { q: 'Can I restrict printing or copying without a password?', a: 'Full permission restrictions require a PDF editor with advanced settings. This tool focuses on access password protection.' },
      ],
    },
  },

  '/organize': {
    title: 'Organize PDF Pages',
    richContent: {
      overview: 'The PDF organizer lets you rearrange, rotate, and delete individual pages before creating a final document. This is helpful when a scanned file has pages out of order, when you need to flip a landscape page, or when you want to remove a blank page from the middle of a document. All changes happen inside your browser.',
      benefits: [
        'Drag and drop pages into any order',
        'Rotate individual pages to correct orientation',
        'Delete unwanted or blank pages',
        'Preview every page as a thumbnail before saving',
        'No server upload — private and secure',
        'Create a clean, professionally ordered document',
      ],
      useCases: [
        'Fixing page order after scanning multi-page documents',
        'Rotating landscape pages that appear sideways',
        'Removing blank filler pages from scanned contracts',
        'Reorganizing chapters or sections of a report',
        'Cleaning up a merged PDF that has pages in the wrong order',
      ],
      howToUse: `
1. Upload your PDF — all pages appear as thumbnails.
2. Drag thumbnails to reorder pages.
3. Use the rotate button on any thumbnail to fix orientation.
4. Click the delete icon to remove unwanted pages.
5. Click "Save & Download" to get your organized PDF.
      `,
      tips: [
        'Use thumbnail view to spot blank or duplicate pages quickly.',
        'Rotate in 90-degree increments — click rotate multiple times if needed.',
        'Reorder before rotating so you see the final layout clearly.',
        'Download and review the result before sharing it.',
      ],
      faqItems: [
        { q: 'Can I undo a page deletion?', a: 'Re-upload the original file and start again — there is no undo once a page is removed in session.' },
        { q: 'Does reordering affect the PDF quality?', a: 'No. Pages are moved as-is without any re-rendering or quality loss.' },
        { q: 'Can I organize scanned PDFs?', a: 'Yes. Any standard PDF, including scanned image-based ones, can be reordered.' },
        { q: 'Is there a page limit?', a: 'There is no hard limit, but very large PDFs may load slowly depending on your device.' },
      ],
    },
  },

  '/watermark': {
    title: 'PDF Watermark',
    richContent: {
      overview: 'Adding a watermark to a PDF marks it as a draft, confidential, or sample — useful when sharing previews with clients, distributing review copies, or protecting original work from unauthorized reuse. You can customize the text, position, and opacity to match your needs, all within the browser.',
      benefits: [
        'Add text watermarks (e.g., DRAFT, CONFIDENTIAL, SAMPLE)',
        'Customize font size, color, opacity, and position',
        'Applies to every page automatically',
        'No file uploaded to any server',
        'Protects intellectual property in shared documents',
        'Free to use with no account needed',
      ],
      useCases: [
        'Marking client proposals as DRAFT before final approval',
        'Adding CONFIDENTIAL to internal reports before distribution',
        'Stamping SAMPLE on portfolio work shared for review',
        'Branding educational materials with a course or school name',
        'Marking invoice previews to prevent misuse',
      ],
      howToUse: `
1. Upload the PDF you want to watermark.
2. Enter the watermark text (e.g., "CONFIDENTIAL" or "DRAFT").
3. Adjust opacity, font size, and position as needed.
4. Click "Apply Watermark & Download".
      `,
      tips: [
        'Use a light gray color at 20–40% opacity for a subtle professional look.',
        'Diagonal placement across the center makes the watermark harder to ignore.',
        'All-caps text reads more clearly as a watermark.',
        'Test with one page before applying to a large document.',
      ],
      faqItems: [
        { q: 'Can a watermark be removed?', a: 'Text watermarks added this way can be removed with advanced PDF editing tools. For stronger protection, consider password-protecting the PDF too.' },
        { q: 'Can I add an image watermark (like a logo)?', a: 'This tool focuses on text watermarks. Image watermarks require a more advanced PDF editor.' },
        { q: 'Does it apply to every page?', a: 'Yes. The watermark is added to all pages in the document automatically.' },
        { q: 'Does watermarking reduce quality?', a: 'No. The watermark is added as a transparent text layer without re-encoding the document.' },
      ],
    },
  },

  '/to-jpg': {
    title: 'PDF to JPG',
    richContent: {
      overview: 'Converting PDF pages to JPG images makes it easy to reuse document content in presentations, social media posts, websites, and design projects. Each page of the PDF becomes a separate image file. This tool processes the conversion in your browser and downloads images directly to your device.',
      benefits: [
        'Converts every PDF page to a JPG image',
        'High-resolution output suitable for presentations and web',
        'No file size limit for most documents',
        'Runs fully in the browser — no cloud upload',
        'Images download individually or as a ZIP',
        'No account required',
      ],
      useCases: [
        'Turning a PDF slide deck into shareable images',
        'Extracting infographics from a report to post on social media',
        'Converting scanned documents for use in image editors',
        'Creating image previews of product manuals or brochures',
        'Embedding PDF page content into a website without a PDF viewer',
      ],
      howToUse: `
1. Upload your PDF file.
2. Select the quality or DPI setting if available.
3. Click "Convert to JPG".
4. Download each page as a separate JPG image.
      `,
      tips: [
        'Higher DPI (300+) gives print-quality images but larger file sizes.',
        'For web use, 96–150 DPI is usually enough and keeps files small.',
        'Convert only the pages you need to save processing time.',
        'If the PDF is password protected, unlock it first.',
      ],
      faqItems: [
        { q: 'How many pages can I convert at once?', a: 'All pages are converted in one go. Very long documents may take more time on slower devices.' },
        { q: 'Can I choose which pages to convert?', a: 'Use the PDF splitter first to extract the pages you want, then convert.' },
        { q: 'Why do my images look blurry?', a: 'Increase the DPI setting for sharper output, especially for text-heavy pages.' },
        { q: 'Can I convert a scanned PDF to JPG?', a: 'Yes. Scanned PDFs convert normally — the output will be the scanned image content.' },
      ],
    },
  },

  '/to-word': {
    title: 'PDF to Word',
    richContent: {
      overview: 'Converting a PDF to a Word document lets you edit the content in Microsoft Word or Google Docs. This is useful when you have a PDF report, form, or letter that needs revisions, but the original Word file is unavailable. The tool extracts the text and structure and outputs an editable .docx file.',
      benefits: [
        'Creates an editable .docx file from a PDF',
        'Preserves headings, paragraphs, and basic layout',
        'No cloud processing — runs in the browser',
        'Useful for editing documents when the original source is lost',
        'Free with no sign-up',
        'Compatible with Microsoft Word and Google Docs',
      ],
      useCases: [
        'Editing a received PDF contract that has no editable source',
        'Revising a scanned form to add or change information',
        'Converting PDF reports into editable drafts for collaboration',
        'Extracting text from a PDF to reformat in a new document',
        'Recovering content from an old PDF when the original file is missing',
      ],
      howToUse: `
1. Upload the PDF you want to convert.
2. Click "Convert to Word".
3. Download the .docx file.
4. Open in Microsoft Word, LibreOffice, or Google Docs to edit.
      `,
      tips: [
        'Scanned PDFs convert to text using OCR — quality depends on scan clarity.',
        'Complex multi-column layouts may need manual cleanup after conversion.',
        'Tables in PDFs may not convert perfectly — review and fix them in Word.',
        'For best results, use PDFs with selectable text rather than scanned images.',
      ],
      faqItems: [
        { q: 'Will the formatting be preserved exactly?', a: 'Basic structure is preserved but complex formatting (columns, text boxes) may need adjustment in Word.' },
        { q: 'Can I convert a scanned PDF to Word?', a: 'Yes, using OCR. The accuracy depends on the quality and clarity of the original scan.' },
        { q: 'Is the converted file editable?', a: 'Yes. The output is a standard .docx file that opens in any Word-compatible application.' },
        { q: 'What happens to images in the PDF?', a: 'Images may be embedded in the Word document, but placement might differ from the original.' },
      ],
    },
  },

  '/image-to-pdf': {
    title: 'Image to PDF',
    richContent: {
      overview: 'The Image to PDF tool converts JPG, PNG, and other image formats into a single PDF document. This is ideal for combining photo scans into a portable document, creating a PDF portfolio from images, or submitting documents as a PDF when only photos are available.',
      benefits: [
        'Converts JPG, PNG, WEBP, and more to PDF',
        'Combine multiple images into one PDF document',
        'Set page size and orientation for each image',
        'Runs in the browser without uploading files',
        'Useful for scanning documents with a phone camera',
        'No account required',
      ],
      useCases: [
        'Turning phone-camera scans of receipts into a PDF',
        'Combining multiple product images into a printable catalog',
        'Converting ID photos or certificates into a PDF for submission',
        'Building a photo portfolio as a shareable PDF',
        'Creating a PDF from scanned handwritten notes',
      ],
      howToUse: `
1. Upload one or more image files (JPG, PNG, etc.).
2. Drag to reorder images if combining multiple files.
3. Select page size (A4, Letter, or fit to image) if available.
4. Click "Convert to PDF" and download the result.
      `,
      tips: [
        'Use PNG for images with text for sharper output in the PDF.',
        'For scanned documents, straighten images before converting.',
        'Compress large images before conversion to keep the PDF size manageable.',
        'Set page orientation to landscape for wide images.',
      ],
      faqItems: [
        { q: 'Can I combine multiple images into one PDF?', a: 'Yes. Upload multiple images and they will each become a page in the resulting PDF.' },
        { q: 'What image formats are supported?', a: 'JPG, PNG, WEBP, GIF, and BMP are supported in most browsers.' },
        { q: 'Will image quality be reduced?', a: 'Images are embedded at their original quality unless you apply compression first.' },
        { q: 'Can I control the page size?', a: 'Yes. You can choose A4, Letter, or auto-fit to the image dimensions.' },
      ],
    },
  },

  '/word-to-pdf': {
    title: 'Word to PDF',
    richContent: {
      overview: 'Converting a Word document to PDF ensures the layout, fonts, and formatting remain exactly as designed — regardless of the device or software the recipient uses. PDFs are universally readable and cannot be accidentally edited, making them the preferred format for official submissions, client deliverables, and formal correspondence.',
      benefits: [
        'Preserves fonts, layout, and formatting exactly',
        'PDF output is universally readable on any device',
        'Prevents accidental editing by recipients',
        'Runs in the browser — no Word software needed on the converter side',
        'Free with no account',
        'Ideal for resumes, proposals, reports, and forms',
      ],
      useCases: [
        'Converting a resume to PDF before submitting a job application',
        'Locking a proposal layout before sending to a client',
        'Preparing a formal report for printing or digital archiving',
        'Converting a contract draft to a read-only PDF',
        'Submitting an assignment or thesis in PDF format',
      ],
      howToUse: `
1. Upload your .docx or .doc Word file.
2. Click "Convert to PDF".
3. Download and review the PDF.
4. Share or submit the PDF as needed.
      `,
      tips: [
        'Review the PDF before sending — complex layouts sometimes shift slightly.',
        'For print submissions, check margins and page breaks in the PDF.',
        'Embedded fonts in the Word doc help preserve the visual appearance.',
        'If images appear blurry, reduce image compression in Word before converting.',
      ],
      faqItems: [
        { q: 'Will the PDF look identical to the Word document?', a: 'Usually yes, but very complex layouts with text boxes or unusual fonts may shift slightly.' },
        { q: 'Can I convert .doc files (older Word format)?', a: 'Yes. Both .doc and .docx formats are supported.' },
        { q: 'Does conversion require Microsoft Word installed?', a: 'No. The tool processes the file directly in the browser.' },
        { q: 'Is the conversion free?', a: 'Yes, completely free with no account or subscription required.' },
      ],
    },
  },

  '/tools/pdf-lightener': {
    title: 'PDF Lightener',
    richContent: {
      overview: 'PDF lightening reduces the brightness of scanned pages that appear too dark, yellowed, or faded. This is especially helpful for old scanned documents, photographs of pages, or printouts where the scan setting was too low. The tool adjusts the brightness of image-based PDF pages to make text more readable.',
      benefits: [
        'Improves readability of dark or overexposed scanned PDFs',
        'Corrects yellowing or fading in old document scans',
        'Runs entirely in the browser',
        'No server upload required',
        'Useful for archiving or reprinting scanned materials',
        'Free to use',
      ],
      useCases: [
        'Lightening a scanned document that came out too dark',
        'Improving readability of an old archived document scan',
        'Preparing a scanned PDF for cleaner printing',
        'Correcting brightness from a poor flatbed scanner setting',
        'Cleaning up mobile camera document scans',
      ],
      howToUse: `
1. Upload your scanned PDF.
2. Adjust the brightness slider to lighten or darken the pages.
3. Preview the result on a sample page.
4. Click "Apply & Download" to save the lightened PDF.
      `,
      tips: [
        'Start with a moderate brightness increase (around 20-30%) and preview.',
        'Too much brightening can wash out faint text — adjust carefully.',
        'This works best on image-based (scanned) PDFs, not text-based ones.',
        'Combine with the PDF organizer to fix orientation before lightening.',
      ],
      faqItems: [
        { q: 'Does this work on text-based PDFs?', a: 'This tool is optimized for scanned/image-based PDFs. Text PDFs do not have brightness to adjust.' },
        { q: 'Will the file size change?', a: 'Slightly, as image layers are re-processed. The change is usually minimal.' },
        { q: 'Can I darken a page instead?', a: 'Yes. The brightness control works in both directions — move the slider left to darken.' },
        { q: 'Is quality reduced?', a: 'There may be minor quality changes due to image processing, but the result is generally still print-quality.' },
      ],
    },
  },

  // ─── IMAGE TOOLS ──────────────────────────────────────────────────────────────

  '/image/compress': {
    title: 'Image Compressor',
    richContent: {
      overview: 'Image compression reduces file size while keeping the visual quality acceptable for its intended use. Smaller images load faster on websites, are easier to send by email, and take less storage space. This tool compresses JPG and PNG images directly in your browser using smart compression without requiring any uploads.',
      benefits: [
        'Reduces file size by 50–80% without visible quality loss',
        'Supports JPG, PNG, WebP, and GIF',
        'Fully browser-based — files stay on your device',
        'Batch process multiple images at once',
        'Improves website page load speed',
        'Free with no account needed',
      ],
      useCases: [
        'Optimizing product images before uploading to an online store',
        'Reducing image size for faster website loading',
        'Compressing photos before sending via email or WhatsApp',
        'Preparing images for social media without losing sharpness',
        'Reducing storage usage on devices or cloud drives',
      ],
      howToUse: `
1. Upload one or more image files.
2. Adjust the quality slider if you want more or less compression.
3. Click "Compress Images".
4. Download the compressed images.
      `,
      tips: [
        'Try quality 80–85% first — it usually gives a great size-to-quality balance.',
        'JPG is best for photos; PNG works better for graphics and logos.',
        'For web use, aim for images under 200 KB when possible.',
        'Preview compressed images at 100% zoom to check for artifacts around text or edges.',
      ],
      faqItems: [
        { q: 'How much smaller will my image be?', a: 'Typically 50–80% smaller, depending on the original file and the compression level you choose.' },
        { q: 'Will compression visibly reduce quality?', a: 'At quality 75–85%, differences are usually imperceptible. At very low quality, artifacts appear around edges and text.' },
        { q: 'What formats are supported?', a: 'JPG, PNG, WebP, and GIF are supported.' },
        { q: 'Are my images uploaded anywhere?', a: 'No. All compression happens inside your browser. Files never leave your device.' },
      ],
    },
  },

  '/image/jpg-to-png': {
    title: 'JPG to PNG Converter',
    richContent: {
      overview: 'Converting JPG to PNG is useful when you need lossless image quality, transparency support, or a format that does not add extra compression each time it is saved. PNG is the preferred format for logos, icons, screenshots with text, and UI graphics. This converter runs in your browser with no file upload needed.',
      benefits: [
        'Lossless PNG output — no further quality degradation',
        'Supports transparent backgrounds in the PNG output',
        'Faster and safer than online services that upload your files',
        'Works on any device with a modern browser',
        'Free with no account',
        'Batch convert multiple images',
      ],
      useCases: [
        'Converting a logo saved as JPG to PNG to restore transparency',
        'Preparing screenshots with text for design work',
        'Converting product images for use in design software',
        'Keeping an image in a format that supports further lossless editing',
        'Converting photos for platforms that require PNG format',
      ],
      howToUse: `
1. Upload your JPG file or multiple JPG files.
2. Click "Convert to PNG".
3. Download the PNG file(s).
      `,
      tips: [
        'Converting JPG to PNG does not restore quality lost during original JPG compression.',
        'PNG files are often larger than JPG — only convert if you specifically need PNG.',
        'Use PNG for graphics with sharp edges or text; keep photos as JPG.',
        'Batch convert to save time when working with multiple files.',
      ],
      faqItems: [
        { q: 'Will the image quality improve after converting to PNG?', a: 'No. Converting from JPG to PNG preserves the current state but cannot recover quality lost in the original JPG compression.' },
        { q: 'Will the PNG have a transparent background?', a: 'Only if the original JPG had transparency data — which is rare. Use a background remover tool if you need transparency.' },
        { q: 'Why is my PNG file larger than the JPG?', a: 'PNG uses lossless compression so it retains all pixel data, which results in larger files than JPG, especially for photographs.' },
        { q: 'Can I convert multiple JPGs at once?', a: 'Yes. Upload multiple files and they will all be converted in one batch.' },
      ],
    },
  },

  '/image/png-to-jpg': {
    title: 'PNG to JPG Converter',
    richContent: {
      overview: 'Converting PNG to JPG significantly reduces file size, making images faster to upload, share, and display on websites. JPG compression is ideal for photographs and images without transparency. This browser-based converter handles the conversion without uploading your files anywhere.',
      benefits: [
        'Drastically reduces file size compared to PNG',
        'Faster website load times with smaller JPG images',
        'Ideal for photos and images without transparency',
        'Adjustable quality to balance size and sharpness',
        'Runs in the browser with no server upload',
        'Free and unlimited conversions',
      ],
      useCases: [
        'Reducing PNG screenshots to smaller JPG files for sharing',
        'Converting high-res PNG product images to JPG for faster web loading',
        'Preparing images for platforms that prefer JPG (e.g., most social media)',
        'Reducing file size before uploading to a CMS or email',
        'Converting design exports from PNG to web-optimized JPG',
      ],
      howToUse: `
1. Upload your PNG file or multiple PNG files.
2. Adjust the quality slider if needed.
3. Click "Convert to JPG".
4. Download your JPG file(s).
      `,
      tips: [
        'PNG images with transparency will have the transparent areas filled with white in the JPG output.',
        'Quality 85–90% gives near-identical appearance to PNG with much smaller size.',
        'Do not convert logos or icons to JPG — the compression creates visible artifacts on sharp edges.',
        'For photos, JPG is almost always the better choice over PNG.',
      ],
      faqItems: [
        { q: 'What happens to transparent areas?', a: 'Transparent pixels are filled with white (or sometimes black) because JPG does not support transparency.' },
        { q: 'How much smaller will my image be?', a: 'Typically 60–80% smaller, depending on image content and the quality setting you choose.' },
        { q: 'Is quality loss visible?', a: 'At quality 85% or higher, most people cannot spot the difference. At lower settings, compression artifacts appear around edges.' },
        { q: 'Can I batch-convert multiple PNG files?', a: 'Yes. Upload multiple files and all will be converted in a single batch.' },
      ],
    },
  },

  '/image/enhance': {
    title: 'Image Enhancer',
    richContent: {
      overview: 'The image enhancer adjusts brightness, contrast, sharpness, and saturation to improve the overall appearance of photos and document scans. It is useful for brightening underexposed photos, improving scanned document clarity, and making images more vibrant before sharing or printing.',
      benefits: [
        'Adjust brightness, contrast, saturation, and sharpness',
        'Improve scanned document readability',
        'Enhance underexposed or overexposed photos',
        'All editing runs in the browser — no upload needed',
        'Non-destructive — original file stays unchanged',
        'Free and works on any modern browser',
      ],
      useCases: [
        'Brightening a dark photo taken in low light',
        'Improving the contrast of a scanned document',
        'Boosting saturation of product images for better visual appeal',
        'Sharpening blurry images before printing',
        'Correcting an overexposed outdoor photo',
      ],
      howToUse: `
1. Upload an image file.
2. Use the sliders to adjust brightness, contrast, sharpness, and saturation.
3. Preview the changes in real time.
4. Click "Download Enhanced Image" to save the result.
      `,
      tips: [
        'Increase contrast slightly to make text in scanned documents stand out more.',
        'Avoid over-saturation — a subtle boost looks more natural.',
        'For portraits, keep sharpening light to avoid harsh skin texture.',
        'Start with brightness and contrast before adjusting other settings.',
      ],
      faqItems: [
        { q: 'Does enhancing reduce image quality?', a: 'Minor quality changes occur from re-encoding, but the effect is usually minimal at standard quality settings.' },
        { q: 'Can I enhance scanned documents?', a: 'Yes. Increasing contrast and brightness is particularly effective for improving scanned text clarity.' },
        { q: 'Can I undo changes?', a: 'Reset sliders to zero to restore the original appearance, or re-upload the file to start fresh.' },
        { q: 'What file formats can I enhance?', a: 'JPG, PNG, WebP, and GIF are supported.' },
      ],
    },
  },

  '/image/collage': {
    title: 'Image Collage Maker',
    richContent: {
      overview: 'The image collage maker combines multiple photos into a single composed image. This is useful for before-and-after comparisons, social media posts, product galleries, and school or event photo collections. Choose from grid layouts or side-by-side arrangements and download a single composed image.',
      benefits: [
        'Combine multiple images into one layout',
        'Choose from various grid and layout options',
        'Quick creation for social media content',
        'No account or cloud upload needed',
        'Runs fully in the browser',
        'Download as JPG or PNG',
      ],
      useCases: [
        'Creating before-and-after comparison images',
        'Building a multi-image social media post',
        'Combining product photos into a feature overview',
        'Making a school project or event photo grid',
        'Presenting multiple angles of a product in one image',
      ],
      howToUse: `
1. Upload two or more images.
2. Select a layout template (grid, side-by-side, 2x2, etc.).
3. Adjust spacing or background color if available.
4. Click "Create Collage" and download the result.
      `,
      tips: [
        'Use images with similar aspect ratios for a more balanced collage.',
        'Leave a small gap between images to give the layout a cleaner look.',
        'Higher resolution source images produce sharper collage output.',
        'For social media, check the target platform\'s recommended image dimensions before creating.',
      ],
      faqItems: [
        { q: 'How many images can I combine?', a: 'This depends on the layout. Most layouts support 2 to 6 images in a single collage.' },
        { q: 'What formats can I upload?', a: 'JPG, PNG, and WebP images are supported.' },
        { q: 'Can I customize the background color?', a: 'Yes. You can usually choose white, black, or a custom color for the gaps between images.' },
        { q: 'What is the output resolution?', a: 'The output resolution depends on the source images. Using high-resolution originals gives the best result.' },
      ],
    },
  },

  '/image/html-to-image': {
    title: 'HTML to Image',
    richContent: {
      overview: 'The HTML to Image tool converts web page content or custom HTML code into a PNG or JPG image. This is useful for creating social media graphics from HTML templates, capturing a styled web section as an image, or generating image assets from code without taking a manual screenshot.',
      benefits: [
        'Convert HTML/CSS code to a high-quality image',
        'Capture web content without manual screenshots',
        'Useful for generating social media cards from templates',
        'Supports custom width and height settings',
        'Runs in the browser',
        'Free with no account required',
      ],
      useCases: [
        'Generating social media preview cards from HTML templates',
        'Capturing a styled chart or data visualization as an image',
        'Creating thumbnail images from HTML-based layouts',
        'Producing certificate or badge images from HTML',
        'Rendering email templates as image previews',
      ],
      howToUse: `
1. Paste your HTML code into the input field.
2. Set the desired output width if needed.
3. Click "Convert to Image".
4. Download the PNG or JPG result.
      `,
      tips: [
        'Use inline styles or embedded CSS for reliable rendering.',
        'External fonts may not load — use web-safe fonts or include font-face declarations.',
        'Test with simple HTML first before converting complex layouts.',
        'For high-resolution output, increase the scale or width setting.',
      ],
      faqItems: [
        { q: 'Does it support external CSS files?', a: 'Not always. Use inline styles or a <style> tag within the HTML for consistent results.' },
        { q: 'Can I capture a full webpage?', a: 'This tool is designed for pasted HTML snippets, not full live webpages. Use a browser screenshot tool for full pages.' },
        { q: 'What output formats are available?', a: 'PNG and JPG are the standard outputs.' },
        { q: 'Will images inside the HTML render?', a: 'Images with accessible URLs will load. Local or relative image paths may not work.' },
      ],
    },
  },

  '/image/heic-to-jpg': {
    title: 'HEIC to JPG Converter',
    richContent: {
      overview: 'HEIC is the default photo format on iPhones (iOS 11 and later). While HEIC files are space-efficient, they are not natively supported by Windows or most non-Apple apps. Converting HEIC to JPG makes your iPhone photos compatible with any device, editing software, or social media platform.',
      benefits: [
        'Makes iPhone photos compatible with Windows and Android',
        'Converts HEIC to universally supported JPG',
        'Runs in the browser without installing software',
        'Privacy-first — no cloud upload',
        'Free with no subscription',
        'Works with individual or batch HEIC files',
      ],
      useCases: [
        'Opening iPhone photos on a Windows PC or Android device',
        'Uploading iPhone photos to platforms that reject HEIC format',
        'Sharing photos via email without compatibility issues',
        'Editing iPhone photos in non-Apple apps that only support JPG',
        'Archiving HEIC photos in the more universally compatible JPG format',
      ],
      howToUse: `
1. Upload your HEIC file(s) from an iPhone or other Apple device.
2. Click "Convert to JPG".
3. Download the converted JPG file(s).
      `,
      tips: [
        'On iPhone, go to Settings > Camera > Formats > Most Compatible to capture JPG directly instead of HEIC.',
        'Quality is preserved well in the conversion — HEIC and JPG are both lossy formats.',
        'Batch convert multiple HEIC files to save time.',
        'After converting, verify the files open correctly before deleting the originals.',
      ],
      faqItems: [
        { q: 'Why does my iPhone save photos as HEIC?', a: 'Apple uses HEIC by default because it stores similar quality at roughly half the file size of JPG.' },
        { q: 'Does quality change during conversion?', a: 'Slightly. Both formats are lossy, but the quality difference at standard settings is barely noticeable.' },
        { q: 'Can I convert HEIC to PNG instead?', a: 'This tool converts to JPG. For PNG output, use the JPG to PNG converter after this step.' },
        { q: 'Are my HEIC files uploaded to a server?', a: 'No. Conversion happens entirely in your browser.' },
      ],
    },
  },

  '/tools/background-remover': {
    title: 'Background Remover',
    richContent: {
      overview: 'The background remover uses AI to detect and erase the background from photos, leaving the subject on a transparent PNG. This is useful for product photography, profile pictures, ID photos, and marketing materials. The tool processes the image in the browser using on-device AI models.',
      benefits: [
        'Removes backgrounds automatically using AI detection',
        'Output is a transparent PNG ready for any background',
        'No manual masking or editing needed',
        'Works on portraits, products, and objects',
        'Files stay on your device — no cloud upload',
        'Free to use',
      ],
      useCases: [
        'Removing the background from product photos for an online store',
        'Preparing profile photos with transparent backgrounds for design work',
        'Creating ID or passport-style photos from regular photos',
        'Isolating subjects for use in marketing banners and presentations',
        'Preparing images for custom stickers or merchandise',
      ],
      howToUse: `
1. Upload a JPG or PNG image.
2. The AI detects and removes the background automatically.
3. Preview the result with the transparent background.
4. Download the PNG with transparency preserved.
      `,
      tips: [
        'Images with clear contrast between subject and background work best.',
        'High-resolution source images give cleaner edge results.',
        'Check edges carefully — use an image editor for fine-tuning if needed.',
        'For product photos, a plain or solid-color background in the original gives cleaner detection.',
      ],
      faqItems: [
        { q: 'What file format is the output?', a: 'PNG with transparent background. JPG does not support transparency.' },
        { q: 'Does it work on complex backgrounds?', a: 'Yes, but results are more accurate on plain or contrasting backgrounds. Busy backgrounds may need manual touchup.' },
        { q: 'Can I add a new background after removal?', a: 'Yes. Open the transparent PNG in any image editor and place a new background layer behind the subject.' },
        { q: 'Are my photos uploaded to a server?', a: 'No. AI processing happens locally in the browser using on-device models.' },
      ],
    },
  },

  // ─── CALCULATOR TOOLS ─────────────────────────────────────────────────────────

  '/calculator/bmi': {
    title: 'BMI Calculator',
    richContent: {
      overview: 'The BMI (Body Mass Index) calculator estimates your body weight category based on your height and weight. BMI is a widely used screening tool by health professionals to identify potential weight-related health risks. It provides a quick reference, though it is not a diagnostic tool on its own.',
      benefits: [
        'Instant BMI calculation with your height and weight',
        'Supports metric (kg/cm) and imperial (lb/in) units',
        'Shows which BMI category you fall into',
        'No account or data storage',
        'Useful as a quick health screening reference',
        'Free and private — no data leaves your browser',
      ],
      useCases: [
        'Checking your current BMI as a general health reference',
        'Tracking BMI changes over a weight loss or gain journey',
        'Understanding the BMI categories before a medical appointment',
        'Helping a student understand BMI calculations for a health project',
        'Quick reference for fitness goal planning',
      ],
      howToUse: `
1. Select your unit system (metric or imperial).
2. Enter your height and weight.
3. Click "Calculate BMI".
4. Review your BMI value and the corresponding category.
      `,
      tips: [
        'BMI does not account for muscle mass — athletes often show "overweight" BMI despite being healthy.',
        'BMI is a screening tool, not a diagnosis. Consult a doctor for personalized health advice.',
        'Waist circumference is a useful complement to BMI for assessing health risk.',
        'Children and teens use different BMI charts based on age and gender.',
      ],
      faqItems: [
        { q: 'What is a healthy BMI range?', a: 'For adults, BMI 18.5–24.9 is considered normal weight. Under 18.5 is underweight; 25–29.9 is overweight; 30+ is obese.' },
        { q: 'Is BMI accurate for athletes?', a: 'Not always. Athletes with high muscle mass may have elevated BMI despite low body fat. BMI is best used as a starting point.' },
        { q: 'How often should I check my BMI?', a: 'Monthly or quarterly is enough for general tracking. BMI changes slowly — daily checks are not necessary.' },
        { q: 'Does BMI differ for men and women?', a: 'The BMI scale is the same, but interpretation may differ. Women naturally carry more body fat at the same BMI as men.' },
      ],
    },
  },

  '/calculator/age': {
    title: 'Age Calculator',
    richContent: {
      overview: 'The age calculator computes your exact age in years, months, and days from your date of birth. It is useful for precise age verification, calculating a child\'s age for school enrollment, figuring out eligibility for age-restricted services, or just satisfying your curiosity about exactly how old you are today.',
      benefits: [
        'Calculates exact age in years, months, and days',
        'Handles leap years correctly',
        'Shows days until next birthday',
        'Works for any date from the past',
        'No data stored or transmitted',
        'Free and instant',
      ],
      useCases: [
        'Verifying exact age for legal or official documents',
        'Calculating a child\'s age for school enrollment requirements',
        'Checking eligibility for age-restricted programs or services',
        'Finding out how many days until a birthday',
        'Calculating the age of a historical figure for research',
      ],
      howToUse: `
1. Enter your date of birth (day, month, year).
2. The tool calculates your age as of today automatically.
3. View your age in years, months, and days.
4. See the number of days until your next birthday.
      `,
      tips: [
        'Useful for calculating ages in official paperwork where exact months and days matter.',
        'For school enrollment, check the cutoff date requirements in your region.',
        'You can also enter a past or future reference date to calculate age at a specific point in time.',
      ],
      faqItems: [
        { q: 'Does it account for leap years?', a: 'Yes. The calculator handles February 29 birthdays and counts leap years correctly.' },
        { q: 'Can I calculate age on a specific date (not today)?', a: 'Some versions support a custom reference date. Check the tool for that option.' },
        { q: 'Is the calculation accurate to the day?', a: 'Yes. The calculator gives age in exact years, months, and days.' },
        { q: 'Can I use this for historical date calculations?', a: 'Yes. Enter any past date of birth to calculate the age of a person or the age of an event.' },
      ],
    },
  },

  '/calculator/days': {
    title: 'Days Between Dates Calculator',
    richContent: {
      overview: 'The days calculator finds the exact number of days between two dates. This is useful for counting down to an event, calculating the duration of a project, finding out how long ago something happened, or determining whether a deadline has been met.',
      benefits: [
        'Calculates exact days between any two dates',
        'Shows result in days, weeks, and months',
        'Handles leap years automatically',
        'Works for past, present, and future dates',
        'Instant result with no calculation errors',
        'Free with no account',
      ],
      useCases: [
        'Counting days until a wedding, birthday, or event',
        'Calculating the duration of a project or contract period',
        'Checking how many days are left before a deadline',
        'Determining days elapsed since a medical procedure',
        'Calculating rental period duration for invoicing',
      ],
      howToUse: `
1. Enter the start date.
2. Enter the end date.
3. Click "Calculate" to see the number of days between them.
      `,
      tips: [
        'For project planning, calculate buffer days between milestone dates.',
        'Use it to verify contract or rental period lengths.',
        'Combine with the working days calculator to exclude weekends.',
      ],
      faqItems: [
        { q: 'Does it include the start and end date?', a: 'Results may vary by setting. The tool typically counts from start to end, which includes one or both boundary dates depending on implementation.' },
        { q: 'Can I calculate future dates?', a: 'Yes. Enter any future end date and the calculator will count the days from today or from your start date.' },
        { q: 'Does it account for leap years?', a: 'Yes. February 29 is handled correctly in leap year calculations.' },
        { q: 'Can I get results in weeks and months too?', a: 'Yes. The result is typically shown in days, with an approximate weeks and months breakdown.' },
      ],
    },
  },

  '/calculator/currency': {
    title: 'Currency Converter',
    richContent: {
      overview: 'The currency converter converts amounts between major world currencies using up-to-date exchange rates. It is useful for travel planning, international purchasing, invoice calculation, and cross-border business transactions. Results are based on live or recently cached exchange rate data.',
      benefits: [
        'Converts between 150+ world currencies',
        'Uses current or recently cached exchange rates',
        'Instant conversion as you type',
        'Shows the reverse rate automatically',
        'No account required',
        'Free to use',
      ],
      useCases: [
        'Planning a travel budget in a foreign currency',
        'Converting an international invoice to your home currency',
        'Checking the exchange rate before a wire transfer',
        'Comparing prices when shopping across borders',
        'Calculating profit or cost in multiple currencies for a business',
      ],
      howToUse: `
1. Enter the amount you want to convert.
2. Select the source currency (e.g., USD).
3. Select the target currency (e.g., EUR).
4. View the converted amount instantly.
      `,
      tips: [
        'Exchange rates fluctuate throughout the day — check rates close to the time of your transaction.',
        'Bank and card exchange rates often differ from interbank rates — factor in a 1–3% margin.',
        'For large transfers, compare rates across banks and specialist transfer services.',
        'Bookmark the page if you need to check rates regularly.',
      ],
      faqItems: [
        { q: 'How current are the exchange rates?', a: 'Rates are updated regularly from financial data providers, but may lag slightly behind real-time market rates.' },
        { q: 'Does this include bank fees?', a: 'No. This shows mid-market rates. Banks and transfer services add their own margins and fees.' },
        { q: 'Can I convert between cryptocurrencies?', a: 'This tool focuses on traditional fiat currencies. Some versions include popular cryptocurrencies like BTC and ETH.' },
        { q: 'Is the conversion accurate for financial transactions?', a: 'Use this as a reference guide. Always confirm the exact rate with your bank or payment provider before transacting.' },
      ],
    },
  },

  '/calculator/home-loan': {
    title: 'Home Loan Calculator',
    richContent: {
      overview: 'The home loan calculator estimates your monthly mortgage payment based on the loan amount, interest rate, and loan term. It helps first-time buyers understand what they can afford, compare loan options, and plan a repayment budget before approaching a bank or lender.',
      benefits: [
        'Calculates monthly EMI or mortgage payments instantly',
        'Shows total interest paid over the loan term',
        'Helps compare different loan amounts and terms',
        'Useful for budgeting and affordability planning',
        'No account or personal data needed',
        'Free with instant results',
      ],
      useCases: [
        'Estimating monthly payments before applying for a home loan',
        'Comparing a 15-year vs 30-year mortgage payment',
        'Understanding how interest rate changes affect monthly cost',
        'Planning a down payment to keep EMIs within budget',
        'Checking total interest cost over the full loan term',
      ],
      howToUse: `
1. Enter the loan amount (home price minus down payment).
2. Enter the annual interest rate offered by your lender.
3. Enter the loan term in years.
4. Click "Calculate" to see the monthly payment and total cost.
      `,
      tips: [
        'A larger down payment reduces the loan amount and total interest paid.',
        'Even a 0.5% lower interest rate can save thousands over a 20-year loan.',
        'Compare both 15-year and 30-year terms — shorter loans cost less in total interest.',
        'Add property taxes and insurance to the payment estimate for a realistic budget.',
      ],
      faqItems: [
        { q: 'Does this include property taxes and insurance?', a: 'No. This calculates principal and interest only. Add taxes and insurance separately for a total housing cost estimate.' },
        { q: 'Is this the same as an EMI calculator?', a: 'Yes. EMI (Equated Monthly Installment) is the same concept — a fixed monthly loan payment covering interest and principal.' },
        { q: 'Can I calculate early payoff scenarios?', a: 'This tool calculates the standard amortization. For early payoff, enter a shorter loan term to see the adjusted payment.' },
        { q: 'Does it work for any currency?', a: 'Yes. The calculator uses amounts — enter values in your local currency and interpret the output accordingly.' },
      ],
    },
  },

  '/calculator/sales-tax': {
    title: 'Sales Tax Calculator',
    richContent: {
      overview: 'The sales tax calculator adds or removes a tax percentage from a product price. It is useful for understanding the final cost of a purchase, calculating the pre-tax price when only the total is known, or verifying invoice totals when billing customers in different tax jurisdictions.',
      benefits: [
        'Add tax to a price (gross calculation)',
        'Remove tax from a total (reverse calculation)',
        'Supports custom tax rates for any jurisdiction',
        'Instant result with no rounding errors',
        'Useful for invoicing, budgeting, and shopping',
        'Free with no account needed',
      ],
      useCases: [
        'Calculating the total price of a purchase including VAT or GST',
        'Finding the pre-tax price from a tax-inclusive total',
        'Verifying the tax amount on an invoice',
        'Estimating import duty or tax on an international purchase',
        'Comparing the tax impact of different purchase amounts',
      ],
      howToUse: `
1. Enter the base price or the tax-inclusive total.
2. Enter the tax rate percentage (e.g., 10 for 10%).
3. Select whether to add tax or extract it from a total.
4. View the calculated tax amount and final price.
      `,
      tips: [
        'For VAT-registered businesses, use the reverse calculation to extract the net amount from an invoice.',
        'Check your local or state tax rate before using the result for official purposes.',
        'GST, VAT, and HST are all percentage-based sales taxes that this calculator handles.',
      ],
      faqItems: [
        { q: 'What is the difference between adding tax and reverse tax?', a: 'Adding tax: price + tax = total. Reverse: given the total, find what the pre-tax price was.' },
        { q: 'Can I use this for VAT or GST?', a: 'Yes. Enter the applicable VAT or GST percentage and the calculator works the same way.' },
        { q: 'Does it work for multiple tax rates?', a: 'Calculate each rate separately and add the results for compound tax scenarios.' },
        { q: 'Is it accurate for official accounting?', a: 'Use this as a reference tool. For official tax filings, use certified accounting software.' },
      ],
    },
  },

  '/calculator/vehicle-mileage': {
    title: 'Vehicle Mileage Calculator',
    richContent: {
      overview: 'The vehicle mileage calculator estimates fuel consumption and running costs based on distance traveled, fuel efficiency, and fuel price. It helps drivers plan road trips, compare the cost efficiency of different vehicles, and track monthly fuel expenses.',
      benefits: [
        'Calculates fuel cost for any trip or distance',
        'Supports km/L, L/100km, and MPG units',
        'Compare running costs between two vehicles',
        'Helps plan road trip budgets',
        'No account required',
        'Free and instant',
      ],
      useCases: [
        'Estimating fuel cost for a long road trip',
        'Comparing the fuel efficiency of two cars before buying',
        'Calculating monthly fuel spend based on commute distance',
        'Tracking fuel efficiency changes after a vehicle service',
        'Deciding between two routes based on fuel cost',
      ],
      howToUse: `
1. Enter the distance of your trip (km or miles).
2. Enter your vehicle's fuel efficiency (km/L or MPG).
3. Enter the current fuel price per liter or gallon.
4. Click "Calculate" to see the estimated fuel cost.
      `,
      tips: [
        'Real-world fuel efficiency is usually 10–15% lower than manufacturer ratings.',
        'Highway driving is typically more efficient than city stop-and-go traffic.',
        'Air conditioning, cargo weight, and tire pressure all affect fuel consumption.',
        'Track actual fill-up records for the most accurate efficiency data.',
      ],
      faqItems: [
        { q: 'What units does the calculator support?', a: 'It supports km/L, L/100km, and MPG (miles per gallon) for flexibility across regions.' },
        { q: 'Is it accurate for hybrid or electric vehicles?', a: 'Electric vehicles use kWh/100km or miles/kWh — not fuel-based efficiency. This calculator is designed for combustion engine vehicles.' },
        { q: 'Can I compare two vehicles?', a: 'Yes. Run the calculator twice with different efficiency values and compare the resulting fuel costs.' },
        { q: 'How do I find my vehicle\'s fuel efficiency?', a: 'Check the owner\'s manual, the manufacturer\'s website, or track your actual km-per-tank from recent fill-ups.' },
      ],
    },
  },

  '/calculator/working-days': {
    title: 'Working Days Calculator',
    richContent: {
      overview: 'The working days calculator counts the number of business days between two dates, excluding weekends and optionally public holidays. It is useful for project planning, contract deadlines, payroll calculations, and legal notice periods where only weekdays count.',
      benefits: [
        'Counts only weekdays (Mon–Fri) between two dates',
        'Excludes weekends automatically',
        'Useful for project timelines and deadlines',
        'Handles leap years correctly',
        'Free with no account required',
        'Instant result',
      ],
      useCases: [
        'Calculating delivery or shipping lead times in business days',
        'Finding a deadline that is exactly 30 working days from today',
        'Determining the number of working days in a billing period',
        'Planning project milestones with accurate business-day counts',
        'Calculating notice periods for employment contracts',
      ],
      howToUse: `
1. Enter the start date.
2. Enter the end date.
3. Click "Calculate" to see the number of working days between them.
      `,
      tips: [
        'For international projects, also account for local public holidays in each team\'s country.',
        'Combine this with the days calculator to see the difference between total days and working days.',
        'Use this for payroll calculations when employees are paid per working day.',
      ],
      faqItems: [
        { q: 'Does it exclude public holidays?', a: 'The base version excludes weekends only. Some advanced versions let you add specific holiday dates.' },
        { q: 'Does it include the start and end date?', a: 'Typically the start date is counted and the end date is not, or vice versa. Check the tool\'s notes for its specific convention.' },
        { q: 'Can I use it for countries with different working weeks?', a: 'This version is based on the standard Mon–Fri working week. Some regions have different working days (e.g., Sat–Wed or Sun–Thu).' },
        { q: 'Is it useful for legal notice periods?', a: 'Yes. Legal and employment contracts often specify notice in "business days." This tool helps you count them accurately.' },
      ],
    },
  },

  '/calculator/zodiac': {
    title: 'Zodiac Calculator',
    richContent: {
      overview: 'The zodiac calculator determines your Western astrological sun sign based on your date of birth. It also shows your personality traits associated with that sign. While astrology is not scientifically validated, it remains a popular cultural framework for self-reflection and personality exploration.',
      benefits: [
        'Finds your sun sign instantly from your birth date',
        'Shows dates for all 12 zodiac signs',
        'Includes personality trait descriptions for each sign',
        'Fun and instant — no account needed',
        'Works for any date of birth',
        'Free to use',
      ],
      useCases: [
        'Finding out your zodiac sign for the first time',
        'Checking if you\'re on the cusp between two signs',
        'Exploring personality traits associated with your sign',
        'Filling in zodiac-based fields on social or dating platforms',
        'Generating zodiac-related content for fun or blogging',
      ],
      howToUse: `
1. Enter your date of birth (day and month).
2. Your zodiac sign appears immediately.
3. Read the associated personality traits and sign dates.
      `,
      tips: [
        'If your birthday falls near the transition between two signs, you\'re on the "cusp" — some people identify with both.',
        'Western astrology (this tool) differs from Chinese, Vedic, and other astrological systems.',
        'Your rising sign and moon sign also play a role in full astrological charts — this tool shows the sun sign only.',
      ],
      faqItems: [
        { q: 'What is a zodiac sign?', a: 'A zodiac sign (sun sign) is determined by the position of the sun at the time of your birth, within one of 12 astrological constellations.' },
        { q: 'What if I\'m born on a cusp date?', a: 'Cusp dates vary slightly by year. Enter your exact birth year for the most accurate determination.' },
        { q: 'Is this Western or Chinese astrology?', a: 'This is Western (tropical) astrology. Chinese zodiac is based on the birth year, not the exact date.' },
        { q: 'Is astrology scientifically proven?', a: 'No. Astrology is a cultural and entertainment tradition — not a science. Use it for fun and self-reflection, not as guidance for major decisions.' },
      ],
    },
  },

  '/calculator/unit-converter': {
    title: 'Unit Converter',
    richContent: {
      overview: 'The unit converter converts measurements between different units across categories like length, weight, temperature, volume, area, and speed. It is useful for cooking, construction, science projects, travel, and any situation where you need to switch between metric and imperial units.',
      benefits: [
        'Converts across length, weight, temperature, volume, area, and speed',
        'Supports both metric and imperial unit systems',
        'Instant conversion as you type',
        'No account or installation needed',
        'Free and works in any browser',
        'Useful for school, work, cooking, and travel',
      ],
      useCases: [
        'Converting recipe quantities from cups to milliliters',
        'Converting feet to meters for construction projects',
        'Switching Fahrenheit to Celsius for weather understanding',
        'Converting pounds to kilograms for international shipping',
        'Converting miles to kilometers for travel planning',
      ],
      howToUse: `
1. Select the measurement category (length, weight, temperature, etc.).
2. Enter the value you want to convert.
3. Select the source unit and the target unit.
4. The converted result appears instantly.
      `,
      tips: [
        'Temperature conversions (°C to °F) use a formula, not a ratio — the result is not simply multiplied.',
        'When cooking, use a kitchen scale for weight conversions rather than volume cups for more accuracy.',
        'For engineering or science, double-check significant figures after conversion.',
      ],
      faqItems: [
        { q: 'Can I convert between metric and imperial?', a: 'Yes. The converter supports both systems and allows cross-system conversions like inches to centimeters or pounds to kilograms.' },
        { q: 'Is temperature conversion included?', a: 'Yes. Celsius, Fahrenheit, and Kelvin conversions are all supported.' },
        { q: 'What if I need a less common unit?', a: 'The tool covers the most commonly used units. For highly specialized units, a scientific reference may be more appropriate.' },
        { q: 'Is it accurate enough for professional use?', a: 'Yes for everyday conversions. For precision engineering, use certified conversion tables.' },
      ],
    },
  },

  // ─── DEVELOPER / UTILITY TOOLS ────────────────────────────────────────────────

  '/tools/json-formatter': {
    title: 'JSON Formatter',
    richContent: {
      overview: 'The JSON formatter takes raw or minified JSON and formats it with proper indentation, line breaks, and syntax structure. It also validates whether the JSON is well-formed and highlights errors. This is an essential daily tool for developers working with APIs, configuration files, and data exports.',
      benefits: [
        'Beautifies minified JSON into a readable format',
        'Validates JSON and highlights syntax errors',
        'Supports JSON minification (compact output)',
        'Works with any valid JSON including nested structures',
        'All processing runs in the browser',
        'Free and no account needed',
      ],
      useCases: [
        'Reading API response JSON that comes as a single long line',
        'Validating a JSON configuration file before deploying',
        'Debugging malformed JSON payloads from a server or service',
        'Preparing formatted JSON for documentation or code review',
        'Minifying JSON to reduce payload size before transmission',
      ],
      howToUse: `
1. Paste your JSON code into the input field.
2. Click "Format" to beautify it with proper indentation.
3. Click "Validate" to check for syntax errors.
4. Copy the formatted JSON or click "Minify" for a compact version.
      `,
      tips: [
        'Check line numbers in error messages — JSON errors are often a missing comma or extra bracket.',
        'Use minification before embedding JSON in a production payload to reduce size.',
        'Large JSON files (1MB+) may process slower — consider splitting them.',
        'Keys in JSON must be quoted strings — unquoted keys are not valid JSON.',
      ],
      faqItems: [
        { q: 'What is the difference between formatting and validating?', a: 'Formatting just re-indents valid JSON. Validating checks if the JSON structure is correct according to the JSON specification.' },
        { q: 'Can it handle JSON with comments?', a: 'Standard JSON does not support comments. If your JSON has comments, it is technically JSONC — remove comments first.' },
        { q: 'Is there a file size limit?', a: 'No hard limit, but very large JSON files may be slow to process in the browser.' },
        { q: 'Can I convert JSON to another format?', a: 'Use the Data Converter tool for converting JSON to CSV or other formats.' },
      ],
    },
  },

  '/tools/data-converter': {
    title: 'Data Converter',
    richContent: {
      overview: 'The data converter converts between common data formats — JSON, CSV, XML, and YAML. This is useful for data analysts, developers, and anyone who needs to transform data from one format to another for use in a different tool, system, or database without writing code.',
      benefits: [
        'Converts between JSON, CSV, XML, and YAML',
        'No coding required — paste and convert',
        'Works in the browser with no file upload',
        'Handles nested structures and arrays',
        'Free with no account',
        'Useful for data cleaning and format transformation',
      ],
      useCases: [
        'Converting a CSV export to JSON for use in a web app',
        'Transforming API JSON response into CSV for spreadsheet analysis',
        'Converting configuration files between YAML and JSON',
        'Preparing data for import into different databases or tools',
        'Cleaning and normalizing data from different export formats',
      ],
      howToUse: `
1. Paste your data into the input field.
2. Select the source format (JSON, CSV, XML, or YAML).
3. Select the target format.
4. Click "Convert" and copy or download the result.
      `,
      tips: [
        'CSV files must have consistent column counts per row for reliable JSON output.',
        'Nested JSON structures may flatten or simplify when converting to CSV.',
        'For complex XML with attributes, output JSON may differ from what you expect — preview carefully.',
        'YAML supports comments; JSON does not — comments are dropped on conversion.',
      ],
      faqItems: [
        { q: 'Can it convert large datasets?', a: 'Yes, but very large datasets (10MB+) may be slow in the browser. Consider splitting them first.' },
        { q: 'Does CSV conversion preserve all columns?', a: 'Yes. All columns from the first header row are preserved in the converted output.' },
        { q: 'What happens to nested JSON when converting to CSV?', a: 'Nested objects are often flattened or serialized as a string in a single column.' },
        { q: 'Is the conversion lossless?', a: 'Not always. Some format features (like XML attributes or YAML comments) do not have equivalents in other formats.' },
      ],
    },
  },

  '/tools/sql-formatter': {
    title: 'SQL Formatter',
    richContent: {
      overview: 'The SQL formatter takes raw or compressed SQL queries and formats them with proper indentation, capitalized keywords, and structured layout. Well-formatted SQL is easier to read, debug, and share with teammates. This tool supports standard SQL and common dialects including MySQL, PostgreSQL, and SQLite.',
      benefits: [
        'Formats SQL with consistent indentation and keyword casing',
        'Improves readability for complex multi-join queries',
        'Supports MySQL, PostgreSQL, SQLite, and standard SQL',
        'Instant formatting in the browser',
        'Free with no account or sign-up',
        'Useful for code reviews, documentation, and debugging',
      ],
      useCases: [
        'Formatting a minified or unreadable SQL query received from a tool',
        'Preparing SQL for a code review or documentation',
        'Cleaning up AI-generated SQL for production use',
        'Debugging a complex multi-table query by improving structure',
        'Standardizing SQL style across a team or project',
      ],
      howToUse: `
1. Paste your SQL query into the input field.
2. Select the SQL dialect if needed (MySQL, PostgreSQL, etc.).
3. Click "Format SQL".
4. Copy the formatted query or download it.
      `,
      tips: [
        'Capitalize SQL keywords (SELECT, FROM, WHERE) for standard readability.',
        'Put each JOIN condition on its own line for complex multi-table queries.',
        'Alias long table names with short aliases to improve readability.',
        'Add a semicolon at the end of each statement as a best practice.',
      ],
      faqItems: [
        { q: 'Does this validate the SQL syntax?', a: 'Formatting is done by the tool, but it does not run the SQL against a database. Syntax errors in the query will not be caught.' },
        { q: 'Does it support stored procedures?', a: 'Basic procedure formatting is supported, but complex procedural SQL may have limited formatting accuracy.' },
        { q: 'Can I format multiple queries at once?', a: 'Yes. Multiple statements separated by semicolons are typically formatted together.' },
        { q: 'What SQL dialects are supported?', a: 'Standard SQL, MySQL, PostgreSQL, SQLite, and Microsoft SQL Server are the most commonly supported.' },
      ],
    },
  },

  '/tools/typing-test': {
    title: 'Typing Speed Test',
    richContent: {
      overview: 'The typing speed test measures how fast and accurately you type in words per minute (WPM). It presents a passage of text to type and calculates your WPM and error rate at the end. Regular practice with typing tests can significantly improve your typing speed for work, school, and daily computer use.',
      benefits: [
        'Measures typing speed in words per minute (WPM)',
        'Tracks accuracy percentage alongside speed',
        'Provides fresh text passages on each attempt',
        'Shows improvement over multiple attempts',
        'Free with no account needed',
        'Useful for job applications requiring typing speed',
      ],
      useCases: [
        'Practicing for a typing speed requirement in a job application',
        'Tracking typing improvement during daily practice',
        'Identifying common typing errors to work on',
        'Preparing for data entry or transcription roles',
        'Competing with friends or benchmarking your speed',
      ],
      howToUse: `
1. Click "Start Test" to begin.
2. Type the displayed text passage as quickly and accurately as possible.
3. When finished, your WPM and accuracy are shown.
4. Click "Try Again" for another attempt.
      `,
      tips: [
        'Focus on accuracy first — speed increases naturally as errors decrease.',
        'Use all your fingers with proper home-row technique for maximum speed.',
        'Avoid looking at the keyboard — keep your eyes on the screen.',
        'Short daily practice sessions of 10–15 minutes improve typing faster than occasional long sessions.',
      ],
      faqItems: [
        { q: 'What is a good typing speed?', a: 'Average typists hit 40–60 WPM. Proficient typists reach 70–90 WPM. Professional typists and programmers often exceed 100 WPM.' },
        { q: 'Does punctuation count in the word count?', a: 'Typically, each group of characters separated by a space counts as a word — including words with punctuation.' },
        { q: 'How do I improve my typing speed?', a: 'Practice daily using proper technique (home row keys), and prioritize accuracy over speed initially.' },
        { q: 'Does this test save my results?', a: 'Results are shown immediately but not stored. Note your best scores manually if you want to track progress.' },
      ],
    },
  },

  '/utilities/qr-generator': {
    title: 'QR Code Generator',
    richContent: {
      overview: 'The QR code generator creates scannable QR codes from URLs, text, phone numbers, email addresses, or any other content. QR codes are ideal for marketing materials, business cards, restaurant menus, product packaging, and contactless information sharing.',
      benefits: [
        'Generate QR codes for URLs, text, phone, email, and more',
        'Download as PNG or SVG for print and digital use',
        'Customize QR code size and error correction level',
        'Runs in the browser — no server needed',
        'Free with unlimited generation',
        'Shareable and scannable with any smartphone camera',
      ],
      useCases: [
        'Adding a QR code to a business card linking to your website',
        'Creating a contactless menu QR code for a restaurant',
        'Linking product packaging to a how-to video or manual',
        'Sharing a WiFi password without typing it',
        'Directing event attendees to a registration or info page',
      ],
      howToUse: `
1. Enter the URL, text, phone number, or other content.
2. Select the size and error correction level if available.
3. Click "Generate QR Code".
4. Download the QR code as PNG or SVG.
      `,
      tips: [
        'Test your QR code with multiple devices before printing.',
        'Use a high error correction level (H) if the QR will be placed on textured or curved surfaces.',
        'Keep URLs short — long URLs make denser QR codes that are harder to scan.',
        'Print QR codes at least 2 cm x 2 cm for reliable scanning.',
      ],
      faqItems: [
        { q: 'Can I edit a QR code after generating it?', a: 'No. QR codes are static — generate a new one if the content changes.' },
        { q: 'What is error correction level?', a: 'Error correction allows QR codes to be read even if partially damaged. Level H allows up to 30% of the code to be obscured.' },
        { q: 'Do QR codes expire?', a: 'Static QR codes do not expire — they work as long as the destination URL or content is valid.' },
        { q: 'Can I track who scans my QR code?', a: 'Not with a static QR code. Use a URL shortener with analytics as the QR destination to track scans.' },
      ],
    },
  },

  '/utilities/qr-decoder': {
    title: 'QR Code Decoder',
    richContent: {
      overview: 'The QR code decoder reads QR codes from uploaded images and extracts the embedded content — whether it is a URL, text message, phone number, or other encoded data. This is useful when you have a QR code image but cannot scan it with a phone, or when you want to check what a QR code contains before scanning it.',
      benefits: [
        'Reads QR codes from uploaded image files',
        'Extracts the embedded URL, text, or data instantly',
        'No phone camera needed — works from any image',
        'Useful for verifying QR code content before scanning',
        'Runs in the browser with no upload to external servers',
        'Free and instant',
      ],
      useCases: [
        'Checking the content of a QR code received in an email or PDF',
        'Verifying that a printed QR code links to the correct URL',
        'Decoding a QR code from a screenshot or document image',
        'Checking QR codes on physical packaging that cannot be scanned in the moment',
        'Archiving or documenting what a QR code contains',
      ],
      howToUse: `
1. Upload an image file containing the QR code.
2. The tool scans and decodes the QR code automatically.
3. View the decoded text, URL, or other content.
4. Copy or follow the link as needed.
      `,
      tips: [
        'Ensure the QR code is clearly visible and not blurry in the image.',
        'Crop the image close to the QR code if the tool has trouble detecting it.',
        'Multiple QR codes in one image may be decoded one at a time.',
        'Use this to verify unfamiliar QR codes are safe before scanning on your phone.',
      ],
      faqItems: [
        { q: 'What image formats are supported?', a: 'JPG, PNG, GIF, and WebP images containing QR codes are typically supported.' },
        { q: 'Can it read a QR code from a screenshot?', a: 'Yes. Screenshots are image files just like any other — upload the screenshot and it will be decoded.' },
        { q: 'What if the QR code is damaged or partially obscured?', a: 'QR codes with high error correction may still decode. Heavily damaged codes may not be readable.' },
        { q: 'Can it decode barcodes too?', a: 'This tool is optimized for QR codes. Some versions also support standard 1D barcodes.' },
      ],
    },
  },

  '/whatsapp-tools': {
    title: 'WhatsApp Tools',
    richContent: {
      overview: 'The WhatsApp Tools hub provides a collection of utilities for WhatsApp users and businesses — including click-to-chat link generation, bulk messaging helpers, and message formatters. These tools are useful for small businesses, customer support teams, and marketers who use WhatsApp to communicate with customers.',
      benefits: [
        'Generate click-to-chat links with prefilled messages',
        'Create wa.me links for any phone number',
        'Format messages with WhatsApp bold, italic, and monospace',
        'No WhatsApp Business account required',
        'Free with unlimited use',
        'Useful for marketing, support, and lead generation',
      ],
      useCases: [
        'Creating a contact link for a business website or social media bio',
        'Generating a quick-message link for a customer support page',
        'Building prefilled inquiry links for a product catalog',
        'Formatting a WhatsApp broadcast message with bold headers',
        'Creating clickable WhatsApp links for print or digital ads',
      ],
      howToUse: `
1. Enter the phone number with country code (e.g., +1XXXXXXXXXX).
2. Type a prefilled message (optional).
3. Click "Generate Link".
4. Copy the link or share it on your website, social media, or ads.
      `,
      tips: [
        'Always include the country code — without it, the link will not work.',
        'Keep prefilled messages short and clear — customers can edit before sending.',
        'Test the link on both iOS and Android before publishing it.',
        'Use on contact pages, product pages, and social media bios for maximum reach.',
      ],
      faqItems: [
        { q: 'Do I need a WhatsApp Business account?', a: 'No. Click-to-chat links work with any WhatsApp account, personal or business.' },
        { q: 'What is the correct phone number format?', a: 'Use international format: country code + number, no spaces or dashes. Example: +12025551234 for a US number.' },
        { q: 'Can the recipient change the prefilled message?', a: 'Yes. The prefilled message is editable by the recipient before they send it.' },
        { q: 'Do these links work on desktop?', a: 'Yes. They open WhatsApp Web on desktops if WhatsApp Web is set up, or prompt to install WhatsApp on mobile.' },
      ],
    },
  },

  // ─── EXCEL TOOLS ──────────────────────────────────────────────────────────────

  '/excel/merge': {
    title: 'Excel Merger',
    richContent: {
      overview: 'The Excel merger combines multiple spreadsheets into a single workbook or combined sheet. This saves time when consolidating data from different team members, departments, or reporting periods. Instead of manually copying and pasting between files, you can merge them in seconds.',
      benefits: [
        'Combines multiple Excel files into one workbook',
        'Keeps sheets separate or merges into a single sheet',
        'Preserves data formatting and structure',
        'Runs in the browser without Excel required',
        'No account or subscription needed',
        'Free to use',
      ],
      useCases: [
        'Consolidating monthly sales reports from different branches',
        'Merging team member data into a master spreadsheet',
        'Combining survey responses from multiple export files',
        'Creating a single project tracker from several sub-files',
        'Aggregating data from multiple reporting periods',
      ],
      howToUse: `
1. Upload two or more Excel (.xlsx or .xls) files.
2. Choose whether to merge sheets or combine into one continuous sheet.
3. Click "Merge Files".
4. Download the merged Excel file.
      `,
      tips: [
        'Ensure column headers are consistent across files for clean merged output.',
        'Remove blank rows from individual files before merging for cleaner results.',
        'Preview the merged file to check for duplicated headers between sheets.',
        'For large datasets, merge in batches to avoid memory issues in the browser.',
      ],
      faqItems: [
        { q: 'Does it support .xls and .xlsx formats?', a: 'Yes. Both older .xls and modern .xlsx Excel formats are supported.' },
        { q: 'Will formulas be preserved?', a: 'Formulas in individual cells are preserved, but cross-file formulas that reference other workbooks will break.' },
        { q: 'What if my sheets have different column structures?', a: 'Sheets are merged row by row — different column structures may result in misaligned data. Align columns before merging for best results.' },
        { q: 'Is there a file size limit?', a: 'No hard limit, but very large Excel files may be slow to process in the browser.' },
      ],
    },
  },

  '/excel/convert': {
    title: 'Excel Converter',
    richContent: {
      overview: 'The Excel converter transforms spreadsheet files into other formats — CSV, PDF, JSON, or HTML. This is useful when you need to share data with a system that does not accept Excel, import spreadsheet data into a database, or create a printable or shareable version of a report.',
      benefits: [
        'Converts Excel to CSV, PDF, JSON, or HTML',
        'Maintains row and column structure',
        'Works without Microsoft Excel installed',
        'Runs in the browser — no cloud upload',
        'Free with no account required',
        'Supports .xlsx and .xls formats',
      ],
      useCases: [
        'Converting a spreadsheet to CSV for database import',
        'Turning an Excel report into a PDF for sharing',
        'Converting Excel data to JSON for web application use',
        'Creating an HTML table version of a spreadsheet for embedding',
        'Exporting data for systems that only accept CSV input',
      ],
      howToUse: `
1. Upload your Excel (.xlsx or .xls) file.
2. Select the target format (CSV, PDF, JSON, or HTML).
3. Click "Convert".
4. Download the converted file.
      `,
      tips: [
        'CSV export loses formatting (bold, colors) — only the data values are preserved.',
        'For multi-sheet workbooks, each sheet converts separately to CSV.',
        'PDF output preserves the visual layout, useful for printing or formal sharing.',
        'JSON output is best for single-sheet, consistently structured data.',
      ],
      faqItems: [
        { q: 'Does CSV conversion preserve formulas?', a: 'No. CSV contains only values — formulas are evaluated and only the result is exported.' },
        { q: 'Can I convert a specific sheet in a multi-sheet workbook?', a: 'Select the sheet before converting if the tool supports sheet selection.' },
        { q: 'Will charts and images be included in PDF output?', a: 'Charts may be included in PDF depending on the tool. Images and complex objects may not always render correctly.' },
        { q: 'Is the converted data editable?', a: 'CSV and JSON are editable. PDF is generally not directly editable without a PDF editor.' },
      ],
    },
  },

  '/pdf/excel-to-pdf': {
    title: 'Excel to PDF',
    richContent: {
      overview: 'Converting Excel spreadsheets to PDF creates a fixed-layout document that is easy to share, print, and view without Excel. The PDF preserves the spreadsheet\'s appearance — columns, rows, formatting, and borders — exactly as they appear in the original file.',
      benefits: [
        'Creates a printable, shareable PDF from an Excel file',
        'Preserves spreadsheet layout, borders, and formatting',
        'No Microsoft Excel required',
        'Runs in the browser without cloud upload',
        'Free with no account needed',
        'Output is universally viewable on any device',
      ],
      useCases: [
        'Converting a financial report to PDF before emailing to clients',
        'Creating a printable invoice from an Excel template',
        'Sharing a read-only version of a spreadsheet',
        'Archiving spreadsheet data in a universal format',
        'Submitting a data table or report in PDF form',
      ],
      howToUse: `
1. Upload your Excel (.xlsx or .xls) file.
2. Click "Convert to PDF".
3. Download and review the PDF.
4. Share or print as needed.
      `,
      tips: [
        'Use "Fit to Page" settings in Excel before converting if columns are cut off in the PDF.',
        'Check print area settings — only the print area exports by default in some tools.',
        'Freeze rows/headers in Excel before converting so they appear at the top of the PDF.',
        'Review the PDF on screen before printing — landscape orientation may be needed for wide sheets.',
      ],
      faqItems: [
        { q: 'Will all sheets in the workbook be converted?', a: 'Typically, only the active sheet or all sheets are included — check the tool options.' },
        { q: 'Does it preserve cell colors and formatting?', a: 'Yes. Background colors, borders, bold text, and number formatting are preserved in the PDF output.' },
        { q: 'Will formulas show results or the formula text?', a: 'The PDF shows the calculated values, not the formula syntax.' },
        { q: 'Can I convert a password-protected Excel file?', a: 'No. Remove the password from the Excel file first, then convert to PDF.' },
      ],
    },
  },

  // ─── TEXT TOOLS ───────────────────────────────────────────────────────────────

  '/tools/text-to-sql': {
    title: 'Text to SQL',
    richContent: {
      overview: 'The Text to SQL tool converts plain-English descriptions of data queries into SQL statements. This helps non-developers run data queries without knowing SQL syntax, and helps developers quickly generate SQL starting points from natural language descriptions. Powered by AI language models.',
      benefits: [
        'Converts plain English to SQL queries using AI',
        'Useful for non-developers who need to query databases',
        'Generates SELECT, INSERT, UPDATE, and JOIN queries',
        'Speeds up query drafting for developers',
        'No SQL expertise required for basic queries',
        'Free to use',
      ],
      useCases: [
        'Generating a SELECT query without knowing SQL syntax',
        'Quickly drafting a complex JOIN query from a description',
        'Teaching SQL by seeing natural language translated to code',
        'Building a prototype query to hand off to a developer',
        'Automating repetitive query generation from business descriptions',
      ],
      howToUse: `
1. Describe your data query in plain English (e.g., "Show all customers who made a purchase in the last 30 days").
2. Optionally provide table or column names to improve accuracy.
3. Click "Generate SQL".
4. Review and adjust the generated SQL before running it.
      `,
      tips: [
        'The more specific your description, the more accurate the SQL output.',
        'Always review and test generated SQL in a safe environment before running on production data.',
        'Provide table and column names in your description for more accurate output.',
        'Use the SQL formatter to clean up the generated output for readability.',
      ],
      faqItems: [
        { q: 'Can I run the generated SQL directly?', a: 'No. This tool generates SQL text — you need to copy it into a database client or application to execute it.' },
        { q: 'How accurate is the generated SQL?', a: 'Accuracy depends on how clearly you describe the query. Simple queries are usually correct; complex logic may need manual adjustment.' },
        { q: 'What SQL dialects does it support?', a: 'The tool generates standard SQL. For dialect-specific syntax (MySQL, PostgreSQL, etc.), review and adjust after generation.' },
        { q: 'Is this safe to use for sensitive data queries?', a: 'Never run AI-generated SQL on production databases without testing on a copy first.' },
      ],
    },
  },

  '/tools/mojibake-decoder': {
    title: 'Mojibake Decoder',
    richContent: {
      overview: 'Mojibake is the garbled text that appears when a document is decoded with the wrong character encoding. This typically looks like strings of strange symbols (e.g., "Ã©" instead of "é"). The Mojibake Decoder identifies likely encoding mismatches and recovers the original readable text.',
      benefits: [
        'Recovers readable text from garbled encoding errors',
        'Detects and corrects common encoding mismatches',
        'Supports UTF-8, Latin-1, Windows-1252, and other encodings',
        'Instant browser-based processing',
        'Free with no account',
        'Useful for restoring corrupted international text',
      ],
      useCases: [
        'Fixing garbled text copied from a PDF or spreadsheet',
        'Recovering readable content from an email with encoding issues',
        'Correcting text exported from a legacy database with wrong encoding',
        'Restoring international characters (accents, special letters) that appear as symbols',
        'Debugging encoding issues in web applications',
      ],
      howToUse: `
1. Paste the garbled (mojibake) text into the input field.
2. The tool detects the likely encoding mismatch automatically.
3. Click "Decode" to recover the readable text.
4. Copy the corrected output.
      `,
      tips: [
        'Common mojibake patterns are caused by UTF-8 text read as Latin-1 or Windows-1252.',
        'If the first decode attempt does not look right, try a different target encoding.',
        'Mojibake from very old databases may require less common encoding combinations.',
        'Use this after exporting from systems with no explicit encoding setting.',
      ],
      faqItems: [
        { q: 'What is mojibake?', a: 'Mojibake (文字化け) is the garbled result of text being decoded with the wrong character encoding — common with international text in mixed-encoding environments.' },
        { q: 'Why does my text look like "Ã©" or "â€™"?', a: 'This specific pattern is UTF-8 text that was incorrectly interpreted as Latin-1 or Windows-1252. This tool can recover it.' },
        { q: 'Can it fix all encoding problems?', a: 'Most common mismatches are fixable. Very unusual or double-encoded text may need manual adjustment.' },
        { q: 'What causes mojibake?', a: 'It usually happens when a database, file, or application sends text in one encoding but the receiver reads it in a different one.' },
      ],
    },
  },

  '/tools/passport-photo': {
    title: 'Passport Photo Cropper',
    richContent: {
      overview: 'The passport photo cropper resizes and crops a portrait photo to meet official passport, visa, or ID photo specifications. Instead of paying for a photo studio, you can prepare a properly sized photo at home and print it yourself. Supports common international specifications including US, UK, EU, and Indian passport sizes.',
      benefits: [
        'Crops and resizes photos to passport/ID specifications',
        'Supports multiple international passport photo sizes',
        'Saves the cost of a professional photo studio visit',
        'Works with smartphone or camera photos',
        'Runs in the browser — private and no upload needed',
        'Download a print-ready file instantly',
      ],
      useCases: [
        'Preparing a passport renewal photo without visiting a studio',
        'Creating a photo for a visa application',
        'Resizing a portrait for an ID card or student card',
        'Creating a professional headshot in a standard format',
        'Preparing employee ID photos in a required dimension',
      ],
      howToUse: `
1. Upload a clear portrait photo (front-facing, neutral expression).
2. Select the passport/ID format (US, UK, EU, etc.).
3. Adjust the crop to center your face correctly.
4. Click "Download" to save the print-ready photo.
      `,
      tips: [
        'Use a plain white or light gray background in your source photo for best results.',
        'Ensure your face fills 70–80% of the frame for most passport standards.',
        'Check specific requirements for your country\'s passport or visa application before finalizing.',
        'Print on matte photo paper for the standard passport photo finish.',
      ],
      faqItems: [
        { q: 'Does this meet official passport photo requirements?', a: 'The tool handles the correct dimensions. You are still responsible for meeting other requirements (expression, lighting, background).' },
        { q: 'What size is a US passport photo?', a: '2 × 2 inches (51 × 51 mm) with the face occupying 1 to 1 3/8 inches from the bottom of the chin to the top of the head.' },
        { q: 'Can I use a phone selfie?', a: 'Yes, but use good lighting and make sure the background is plain and light-colored.' },
        { q: 'Can I print the result at home?', a: 'Yes. Download the image and print on 4×6 photo paper for standard passport photo sheets.' },
      ],
    },
  },

  '/tools/font-preview': {
    title: 'Font Preview',
    richContent: {
      overview: 'The font preview tool lets you see how a piece of text looks in different typefaces and styles. This helps designers, content creators, and developers compare fonts and find the right one for a project before committing to a download or purchase. Preview your own text instantly in hundreds of fonts.',
      benefits: [
        'Preview custom text in hundreds of fonts',
        'Compare multiple fonts side by side',
        'Adjust size, weight, and color for each preview',
        'No font installation needed',
        'Supports Google Fonts and system fonts',
        'Free with no account',
      ],
      useCases: [
        'Finding the right font for a logo or branding project',
        'Comparing serif vs sans-serif fonts for a document design',
        'Previewing a font before purchasing or downloading it',
        'Checking how a specific headline looks in different typefaces',
        'Exploring font pairing options for a website or print project',
      ],
      howToUse: `
1. Type the text you want to preview in the input field.
2. Browse or search the font list.
3. Adjust size, weight, and color as needed.
4. Compare fonts to find the best fit for your project.
      `,
      tips: [
        'Preview with both short headlines and longer body text to see how a font performs at different lengths.',
        'Serif fonts (like Times New Roman) are traditional for print; sans-serif (like Arial) is common on screens.',
        'For brand use, check the font\'s license before commercial use.',
        'Limit body text to 1-2 fonts for a clean, readable design.',
      ],
      faqItems: [
        { q: 'Can I download the fonts from here?', a: 'This tool previews fonts only. Download Google Fonts from fonts.google.com.' },
        { q: 'Are all the fonts free to use commercially?', a: 'Google Fonts are free for commercial use under open licenses. Check individual font licenses before use.' },
        { q: 'Can I preview multiple fonts at the same time?', a: 'Yes. Most font preview tools allow side-by-side comparison of multiple fonts.' },
        { q: 'Does it work offline?', a: 'Google Fonts require internet access. System fonts work offline.' },
      ],
    },
  },

};

export const getToolContent = (path) => toolContentDatabase[path] || null;

export const getAllToolPaths = () => Object.keys(toolContentDatabase);

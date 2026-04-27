import {
  AlignJustify,
  Droplet,
  Edit3,
  Eraser,
  FileDown,
  FileText,
  Image,
  ImageIcon,
  KeyRound,
  Languages,
  Layers,
  Lock,
  MessageCircle,
  Repeat,
  Scissors,
  Search,
  Shuffle,
  Smile,
  Type,
  WrapText,
  Calculator,
  Calendar,
  Clock,
  Activity,
  DollarSign,
  Star,
  QrCode,
  ScanLine,
  Wrench,
  ArrowRightLeft,
  Receipt,
  Home,
  Briefcase,
  Table,
  SlidersHorizontal,
  Images,
  Wand2,
  FileImage,
  Link as LinkIcon,
  FileSpreadsheet,
  Crop,
  Database,
  Keyboard,
  Zap,
  Sparkles,
  FileCode
} from 'lucide-react';

import { FEATURE_FLAGS } from '../config';

export const utilityTools = [
  {
    id: 'qr-generator',
    name: 'QR Code Generator',
    description: 'Instantly generate high-quality QR codes for links, text, or contact information.',
    path: '/utilities/qr-generator',
    icon: QrCode,
    color: 'rgba(59, 130, 246, 0.1)'
  },
  {
    id: 'qr-decoder',
    name: 'QR Code Decoder',
    description: 'Upload a QR code image to quickly extract and read its hidden data.',
    path: '/utilities/qr-decoder',
    icon: ScanLine,
    color: 'rgba(16, 185, 129, 0.1)'
  },
  {
    id: 'url-shortener',
    name: 'URL Shortener',
    description: 'Paste a long URL to instantly generate a trackable short link.',
    path: '/utilities/url-shortener',
    icon: LinkIcon,
    color: 'rgba(139, 92, 246, 0.1)'
  },
  ...(FEATURE_FLAGS.ENABLE_FILE_SHARING ? [{
    id: 'file-share',
    name: 'File Sharing & Shortener',
    description: 'Securely upload files to Cloudflare R2 and generate a short URL instantly.',
    path: '/share',
    icon: LinkIcon, // Note: I need to ensure Link is imported from lucide-react if I use LinkIcon. Actually I can just use Link icon but renamed. I will add it to the imports.
    color: 'rgba(139, 92, 246, 0.1)'
  }] : []),
  ...(FEATURE_FLAGS.ENABLE_SEO_ANALYZER ? [{
    id: 'seo-analyzer',
    name: 'SEO Score Analyzer',
    description: 'Audit your website on-page SEO and get AI-powered recommendations.',
    path: '/seo-analyzer',
    icon: Search,
    color: 'rgba(16, 185, 129, 0.1)'
  }] : []),
  {
    id: 'json-formatter',
    name: 'JSON Formatter & Validator',
    description: 'Clean, format, and validate your JSON data instantly with syntax highlighting.',
    path: '/tools/json-formatter',
    icon: FileCode,
    color: 'rgba(59, 130, 246, 0.1)'
  },
  {
    id: 'data-converter',
    name: 'Data Format Converter',
    description: 'Seamlessly convert between JSON, CSV, XML, YAML, and TOML.',
    path: '/tools/data-converter',
    icon: ArrowRightLeft,
    color: 'rgba(16, 185, 129, 0.1)'
  },
  {
    id: 'sql-formatter',
    name: 'SQL Query Formatter',
    description: 'Beautify your raw SQL queries with proper indentation and keyword highlighting.',
    path: '/tools/sql-formatter',
    icon: Database,
    color: 'rgba(139, 92, 246, 0.1)'
  },
  {
    id: 'text-to-sql',
    name: 'AI Text-to-SQL Generator',
    description: 'Convert plain English questions into optimized SQL queries instantly.',
    path: '/tools/text-to-sql',
    icon: Sparkles,
    color: 'rgba(245, 158, 11, 0.1)'
  },
  {
    id: 'typing-test',
    name: 'Typing Speed Test',
    description: 'Test your WPM and accuracy with a printable certificate result.',
    path: '/tools/typing-test',
    icon: Keyboard,
    color: 'rgba(16, 185, 129, 0.1)'
  }
];

export const pdfTools = [
  {
    id: 'merge',
    name: 'PDF Merger',
    description: 'Combine multiple PDF documents into one organized file.',
    path: '/merge',
    icon: FileDown,
    color: 'rgba(99, 102, 241, 0.1)'
  },
  {
    id: 'split',
    name: 'PDF Splitter',
    description: 'Extract a page range into a new PDF document.',
    path: '/split',
    icon: Scissors,
    color: 'rgba(56, 189, 248, 0.1)'
  },
  {
    id: 'organize',
    name: 'Organize PDF',
    description: 'Reorder or remove pages visually.',
    path: '/organize',
    icon: Layers,
    color: 'rgba(34, 197, 94, 0.1)'
  },
  {
    id: 'word-to-pdf',
    name: 'Word to PDF',
    description: 'Convert Microsoft Word documents into PDF files.',
    path: '/word-to-pdf',
    icon: FileText,
    color: 'rgba(59, 130, 246, 0.1)'
  },
  {
    id: 'watermark',
    name: 'Watermark PDF',
    description: 'Stamp custom text diagonally across every page.',
    path: '/watermark',
    icon: Droplet,
    color: 'rgba(14, 165, 233, 0.1)'
  },
  {
    id: 'edit',
    name: 'Edit PDF',
    description: 'Annotate PDFs with text, color, and placement controls.',
    path: '/edit',
    icon: Edit3,
    color: 'rgba(234, 179, 8, 0.1)'
  },
  {
    id: 'protect',
    name: 'Protect PDF',
    description: 'Secure PDFs with a password or unlock protected files.',
    path: '/protect',
    icon: Lock,
    color: 'rgba(239, 68, 68, 0.1)'
  },
  {
    id: 'to-jpg',
    name: 'PDF to JPG',
    description: 'Convert PDF pages into high-quality JPG images.',
    path: '/to-jpg',
    icon: Image,
    color: 'rgba(139, 92, 246, 0.1)'
  },
  {
    id: 'to-word',
    name: 'PDF to Word',
    description: 'Extract text from PDFs into editable DOCX files.',
    path: '/to-word',
    icon: FileText,
    color: 'rgba(236, 72, 153, 0.1)'
  },
  {
    id: 'excel-to-pdf',
    name: 'Excel to PDF',
    description: 'Convert Microsoft Excel spreadsheets into clean PDF documents.',
    path: '/pdf/excel-to-pdf',
    icon: FileSpreadsheet,
    color: 'rgba(16, 185, 129, 0.1)'
  },
  {
    id: 'pdf-lightener',
    name: 'PDF Lightener',
    description: 'Aggressively reduce PDF file size by stripping metadata and optimizing structure.',
    path: '/tools/pdf-lightener',
    icon: Zap,
    color: 'rgba(249, 115, 22, 0.1)'
  }
];

export const imageTools = [
  {
    id: 'image-compress',
    name: 'Image Compress',
    description: 'Compress images with quality and resize adjustment bars.',
    path: '/image/compress',
    icon: SlidersHorizontal,
    color: 'rgba(14, 165, 233, 0.1)'
  },
  {
    id: 'image-collage',
    name: 'Image Collage',
    description: 'Build custom collages with spacing, layout, and fit adjustments.',
    path: '/image/collage',
    icon: Images,
    color: 'rgba(249, 115, 22, 0.1)'
  },
  {
    id: 'image-enhance',
    name: 'Image Enhance',
    description: 'Enhance brightness, contrast, saturation, and sharpness online.',
    path: '/image/enhance',
    icon: Wand2,
    color: 'rgba(16, 185, 129, 0.1)'
  },
  {
    id: 'image-to-pdf',
    name: 'Image to PDF',
    description: 'Combine multiple JPG or PNG images into a single PDF.',
    path: '/image-to-pdf',
    icon: ImageIcon,
    color: 'rgba(168, 85, 247, 0.1)'
  },
  {
    id: 'jpg-to-png',
    name: 'JPG to PNG',
    description: 'Convert JPEG images into clean PNG files in your browser.',
    path: '/image/jpg-to-png',
    icon: ArrowRightLeft,
    color: 'rgba(59, 130, 246, 0.1)'
  },
  {
    id: 'png-to-jpg',
    name: 'PNG to JPG',
    description: 'Convert PNG images to JPG with background and quality controls.',
    path: '/image/png-to-jpg',
    icon: ArrowRightLeft,
    color: 'rgba(236, 72, 153, 0.1)'
  },
  {
    id: 'html-to-image',
    name: 'HTML to Image',
    description: 'Render HTML and inline CSS into a downloadable image file.',
    path: '/image/html-to-image',
    icon: FileImage,
    color: 'rgba(234, 179, 8, 0.1)'
  },
  ...(FEATURE_FLAGS.ENABLE_HEIC_CONVERTER ? [{
    id: 'heic-to-jpg',
    name: 'HEIC to JPG',
    description: 'Convert Apple HEIC/HEIF photos to JPG securely in your browser.',
    path: '/image/heic-to-jpg',
    icon: Images,
    color: 'rgba(236, 72, 153, 0.1)'
  }] : []),
  {
    id: 'passport-photo',
    name: 'Passport Photo Cropper',
    description: 'Crop your photos to official passport dimensions for UK, US, and other regions.',
    path: '/tools/passport-photo',
    icon: Crop,
    color: 'rgba(59, 130, 246, 0.1)'
  },
  {
    id: 'background-remover',
    name: 'AI Background Remover',
    description: 'Instantly remove backgrounds from your photos using AI and get a transparent PNG.',
    path: '/tools/background-remover',
    icon: Eraser,
    color: 'rgba(16, 185, 129, 0.1)'
  }
];

export const textTools = [
  {
    id: 'remove-punctuation',
    name: 'Remove Punctuation',
    description: 'Strip punctuation marks and symbols from your text.',
    path: '/text/remove-punctuation',
    icon: Type,
    color: 'rgba(14, 165, 233, 0.1)',
    sampleInput: 'Hello, world! Are you testing punctuation: commas, dots, and symbols #1?',
    actionLabel: 'Remove Punctuation'
  },
  {
    id: 'remove-accents',
    name: 'Remove Accents',
    description: 'Normalize accented characters into plain Latin letters.',
    path: '/text/remove-accents',
    icon: Languages,
    color: 'rgba(16, 185, 129, 0.1)',
    sampleInput: 'Cr\u00E8me br\u00FBl\u00E9e, jalape\u00F1o, S\u00E3o Paulo, fa\u00E7ade, and na\u00EFve.',
    actionLabel: 'Remove Accents'
  },
  {
    id: 'remove-duplicate-lines',
    name: 'Remove Duplicate Lines',
    description: 'Keep only the first instance of each repeated line.',
    path: '/text/remove-duplicate-lines',
    icon: FileText,
    color: 'rgba(99, 102, 241, 0.1)',
    sampleInput: 'alpha\nbeta\nalpha\ngamma\nbeta',
    actionLabel: 'Remove Duplicate Lines'
  },
  {
    id: 'remove-empty-lines',
    name: 'Remove Empty Lines',
    description: 'Delete blank lines while preserving the remaining text.',
    path: '/text/remove-empty-lines',
    icon: AlignJustify,
    color: 'rgba(249, 115, 22, 0.1)',
    sampleInput: 'First line\n\n\nSecond line\n\nThird line',
    actionLabel: 'Remove Empty Lines'
  },
  {
    id: 'remove-line-breaks',
    name: 'Remove Line Breaks & Extra Spaces',
    description: 'Join wrapped lines and collapse multiple spaces into one clean paragraph.',
    path: '/text/remove-line-breaks',
    icon: WrapText,
    color: 'rgba(6, 182, 212, 0.1)',
    sampleInput: 'This is a line  \n  that wraps \t across   multiple\nrows.',
    actionLabel: 'Clean Text'
  },
  {
    id: 'remove-extra-spaces',
    name: 'Remove Extra Spaces',
    description: 'Collapse repeated spaces and tabs into cleaner spacing.',
    path: '/text/remove-extra-spaces',
    icon: AlignJustify,
    color: 'rgba(217, 70, 239, 0.1)',
    sampleInput: 'This    sentence   has      too many   spaces.',
    actionLabel: 'Remove Extra Spaces'
  },
  {
    id: 'remove-whitespace',
    name: 'Remove Whitespace',
    description: 'Remove all spaces, tabs, and line breaks entirely.',
    path: '/text/remove-whitespace',
    icon: Eraser,
    color: 'rgba(244, 63, 94, 0.1)',
    sampleInput: 'Keep nothing butcharacters\nfrom this\ttext.',
    actionLabel: 'Remove Whitespace'
  },
  {
    id: 'remove-lines-containing',
    name: 'Remove Lines Containing',
    description: 'Filter out lines that contain a word or phrase you choose.',
    path: '/text/remove-lines-containing',
    icon: Search,
    color: 'rgba(250, 204, 21, 0.1)',
    sampleInput: 'keep this line\nremove this warning\nkeep this as well\nremove this error',
    actionLabel: 'Remove Matching Lines'
  },
  {
    id: 'random-password-generator',
    name: 'Random Password Generator',
    description: 'Generate strong random passwords with custom length and character options.',
    path: '/text/random-password-generator',
    icon: KeyRound,
    color: 'rgba(59, 130, 246, 0.1)',
    sampleInput: '',
    actionLabel: 'Generate Password'
  },
  {
    id: 'random-words',
    name: 'Random Words',
    description: 'Create a fresh set of random words for names, prompts, and placeholders.',
    path: '/text/random-words',
    icon: Shuffle,
    color: 'rgba(16, 185, 129, 0.1)',
    sampleInput: '',
    actionLabel: 'Generate Words'
  },
  {
    id: 'random-emoji',
    name: 'Random Emoji',
    description: 'Generate a random sequence of emoji characters instantly.',
    path: '/text/random-emoji',
    icon: Smile,
    color: 'rgba(244, 114, 182, 0.1)',
    sampleInput: '',
    actionLabel: 'Generate Emoji'
  },
  {
    id: 'word-repeater',
    name: 'Word Repeater',
    description: 'Repeat a word or phrase as many times as you need with a custom separator.',
    path: '/text/word-repeater',
    icon: Repeat,
    color: 'rgba(168, 85, 247, 0.1)',
    sampleInput: 'repeat me',
    actionLabel: 'Repeat Words'
  },
  {
    id: 'font-preview',
    name: 'Google Font Previewer',
    description: 'Type your text and see it instantly rendered across 40+ popular Google Fonts.',
    path: '/tools/font-preview',
    icon: Type,
    color: 'rgba(59, 130, 246, 0.1)'
  }
];

export const linkTools = [
  {
    id: 'whatsapp-link-creator',
    name: 'WhatsApp Link Creator',
    description: 'Create a WhatsApp chat link with a prefilled message for sharing and marketing.',
    path: '/whatsapp-link-creator',
    icon: MessageCircle,
    color: 'rgba(34, 197, 94, 0.12)'
  }
];

export const calculatorTools = [
  {
    id: 'personal-finance-calculator',
    name: 'Personal Finance Analyzer',
    description: 'Comprehensive financial health checker, budget planner, and projection tool.',
    path: '/calculator/personal-finance',
    icon: Activity,
    color: 'rgba(16, 185, 129, 0.1)'
  },
  {
    id: 'finance-calculator',
    name: 'Finance Calculator',
    description: 'Calculate loans, mortgages, and simple investments.',
    path: '/calculator/finance',
    icon: DollarSign,
    color: 'rgba(34, 197, 94, 0.1)'
  },
  {
    id: 'bmi-calculator',
    name: 'BMI Calculator',
    description: 'Calculate your Body Mass Index (BMI).',
    path: '/calculator/bmi',
    icon: Activity,
    color: 'rgba(239, 68, 68, 0.1)'
  },
  {
    id: 'age-calculator',
    name: 'Age Calculator',
    description: 'Calculate your exact age in years, months, and days.',
    path: '/calculator/age',
    icon: Calculator,
    color: 'rgba(59, 130, 246, 0.1)'
  },
  {
    id: 'days-calculator',
    name: 'Days Calculator',
    description: 'Calculate the number of days between two dates.',
    path: '/calculator/days',
    icon: Calendar,
    color: 'rgba(168, 85, 247, 0.1)'
  },
  {
    id: 'duration-calculator',
    name: 'Duration Calculator',
    description: 'Calculate time duration between two specific times.',
    path: '/calculator/duration',
    icon: Clock,
    color: 'rgba(249, 115, 22, 0.1)'
  },
  {
    id: 'zodiac-calculator',
    name: 'Zodiac Signs',
    description: 'Find your astrological zodiac sign based on your birth date.',
    path: '/calculator/zodiac',
    icon: Star,
    color: 'rgba(234, 179, 8, 0.1)'
  },
  {
    id: 'working-days',
    name: 'Working Day Calculator',
    description: 'Calculate the exact number of business days between dates.',
    path: '/calculator/working-days',
    icon: Briefcase,
    color: 'rgba(99, 102, 241, 0.1)'
  },
  {
    id: 'sales-tax',
    name: 'Sales Tax Calculator',
    description: 'Easily add or extract sales tax from any price.',
    path: '/calculator/sales-tax',
    icon: Receipt,
    color: 'rgba(14, 165, 233, 0.1)'
  },
  {
    id: 'home-loan',
    name: 'Home Loan Calculator',
    description: 'Calculate your monthly mortgage payments and total interest.',
    path: '/calculator/home-loan',
    icon: Home,
    color: 'rgba(34, 197, 94, 0.1)'
  },
  {
    id: 'unit-converter',
    name: 'Unit Converter',
    description: 'Convert seamlessly between length, weight, temperature, volume, and area.',
    path: '/calculator/unit-converter',
    icon: ArrowRightLeft,
    color: 'rgba(234, 179, 8, 0.1)'
  },
  ...(FEATURE_FLAGS.ENABLE_TIME_CONVERTER ? [{
    id: 'time-converter',
    name: 'Precision Time Converter',
    description: 'Zero-drift time unit conversions using the anchor method.',
    path: '/calculator/precision-time-converter',
    icon: Clock,
    color: 'rgba(249, 115, 22, 0.1)'
  }] : []),
  {
    id: 'currency',
    name: 'Currency Converter',
    description: 'Live exchange rates for global currencies.',
    path: '/calculator/currency',
    icon: DollarSign,
    color: 'rgba(239, 68, 68, 0.1)'
  }
];

export const excelTools = [
  {
    id: 'excel-merge',
    name: 'Excel Merger',
    description: 'Combine multiple Excel or CSV files into a single workbook.',
    path: '/excel/merge',
    icon: Table,
    color: 'rgba(16, 185, 129, 0.1)'
  },
  {
    id: 'excel-convert',
    name: 'Excel Converter',
    description: 'Convert between XLSX, CSV, and other spreadsheet formats.',
    path: '/excel/convert',
    icon: ArrowRightLeft,
    color: 'rgba(59, 130, 246, 0.1)'
  }
];

export const toolSections = [
  {
    id: 'pdf',
    label: 'PDF Tools',
    path: '/pdf-tools',
    description: 'Open the full PDF tools page and pick the tool you need.',
    icon: FileText,
    tools: pdfTools
  },
  {
    id: 'image',
    label: 'Image Tools',
    path: '/image-tools',
    description: 'Compress, enhance, convert, and combine images in your browser.',
    icon: Image,
    tools: imageTools
  },
  {
    id: 'text',
    label: 'TEXT Tools',
    path: '/text-tools',
    description: 'Open the full text tools page, including generators and cleaners.',
    icon: Type,
    tools: textTools
  },
  {
    id: 'excel',
    label: 'Excel Tools',
    path: '/excel',
    description: 'Merge and convert Excel spreadsheets securely in your browser.',
    icon: Table,
    tools: excelTools
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Link Creator',
    path: '/whatsapp-link-creator',
    description: 'Create a WhatsApp chat link with a prefilled message.',
    icon: MessageCircle,
    tools: linkTools
  },
  {
    id: 'calculators',
    label: 'Calculators & More',
    path: '/calculators',
    description: 'A collection of useful calculators and miscellaneous tools.',
    icon: Calculator,
    tools: calculatorTools
  },
  {
    id: 'utilities',
    label: 'Utility Tools',
    path: '/utilities',
    description: 'Helpful utilities including QR generators and decoders.',
    icon: Wrench,
    tools: utilityTools
  }
];

export const findTextToolById = (toolId) =>
  textTools.find((tool) => tool.id === toolId);

export const findToolSectionById = (sectionId) =>
  toolSections.find((section) => section.id === sectionId);

export const findCalculatorToolById = (toolId) =>
  calculatorTools.find((tool) => tool.id === toolId);

export const findUtilityToolById = (toolId) =>
  utilityTools.find((tool) => tool.id === toolId);

export const findExcelToolById = (toolId) =>
  excelTools.find((tool) => tool.id === toolId);

export const findImageToolById = (toolId) =>
  imageTools.find((tool) => tool.id === toolId);

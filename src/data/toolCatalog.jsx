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
  Table
} from 'lucide-react';

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
    id: 'unit-converter',
    name: 'Unit Converter',
    description: 'Convert seamlessly between length, weight, temperature, volume, and area.',
    path: '/utilities/unit-converter',
    icon: ArrowRightLeft,
    color: 'rgba(234, 179, 8, 0.1)'
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
    id: 'image-to-pdf',
    name: 'Image to PDF',
    description: 'Combine multiple JPG or PNG images into a single PDF.',
    path: '/image-to-pdf',
    icon: ImageIcon,
    color: 'rgba(168, 85, 247, 0.1)'
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
    name: 'Remove Line Breaks',
    description: 'Join wrapped lines into one clean paragraph.',
    path: '/text/remove-line-breaks',
    icon: WrapText,
    color: 'rgba(6, 182, 212, 0.1)',
    sampleInput: 'This is a line\nthat wraps\nacross multiple\nrows.',
    actionLabel: 'Remove Line Breaks'
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

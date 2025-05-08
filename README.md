# Figma Emoji SVG Converter

<div align="center">
  <h3>Transform Figma emoji SVGs into properly rendered foreignObject elements</h3>
  <p>Created with ❤️ by <b>zombcat</b></p>
</div>

## 🎨 Features

- **Convert Figma Emoji SVGs**: Transform emoji SVGs from Figma into properly rendered foreignObject elements for better compatibility
- **Multiple SVG Support**: Upload and convert multiple SVG files at once
- **Automatic Layout**: Responsive design adapts to the number of SVG files being converted
- **Individual & Batch Downloads**: Download individual SVGs or all converted SVGs at once as a ZIP file
- **Easy to Use**: Simple drag-and-drop interface for uploading SVG files
- **Beautiful UI**: Modern, clean interface with delightful animations

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0.0 or later
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/pumpkinzomb/figma-emoji-svg-converter.git
cd figma-emoji-svg-converter
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## 💻 Usage

1. **Upload SVGs**: Drag and drop Figma emoji SVG files into the upload area or click to select files
2. **Convert**: Click the "Convert to ForeignObject SVG" button to process all uploaded SVGs
3. **Download**: 
   - Click the download icon on individual SVGs to download them separately
   - Use the "Download All" button to download all converted SVGs as a ZIP file

## ⚙️ How It Works

The app takes Figma emoji SVGs (which often contain text elements for emoji characters) and converts them into SVGs with foreignObject elements. This approach ensures better compatibility and consistent rendering across different platforms and browsers.

The conversion process:
1. Parses the original SVG to extract emoji content
2. Creates a new SVG with a foreignObject containing the emoji
3. Presents the converted SVG for download

## 🧩 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) with React
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **File Handling**: [react-dropzone](https://react-dropzone.js.org/)
- **ZIP Processing**: [JSZip](https://stuk.github.io/jszip/)

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [Figma](https://www.figma.com/) for their amazing design tool
- All the open-source libraries that made this project possible

---

<div align="center">
  <p>Made with ❤️ by <b>zombcat</b></p>
  <p>© 2024 zombcat. All rights reserved.</p>
</div>

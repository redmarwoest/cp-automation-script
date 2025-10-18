# Poster Generator Worker

A Node.js worker application that generates custom posters using Adobe Illustrator and uploads them to Google Drive.

## Features

- 🎨 **Adobe Illustrator Integration**: Automatically generates posters using Adobe Illustrator scripts
- ☁️ **Google Drive Upload**: Seamlessly uploads generated posters to Google Drive
- 🎨 **Color Scheme Management**: Supports multiple color schemes for poster customization
- 📊 **Course Data Processing**: Handles golf course data and scorecard information
- 🔄 **Queue Processing**: Processes poster generation requests from a queue system

## Project Structure

```
├── poster-generator.js          # Main poster generation logic
├── google-drive.js             # Google Drive integration
├── color-schemes.js            # Color scheme definitions
├── simple-poster-worker-complete.js  # Complete worker implementation
├── scripts/
│   └── generatePoster.jsx      # Adobe Illustrator script
└── package.json               # Dependencies and configuration
```

## Dependencies

- `googleapis` - Google Drive API integration
- `jsdom` - DOM manipulation for script processing
- `open` - File system operations

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Google Drive API:**
   - Add your `service-account-key.json` file to the project root
   - Ensure the service account has Google Drive API access

3. **Adobe Illustrator Setup:**
   - Ensure Adobe Illustrator is installed
   - The application will automatically run Illustrator scripts

## Usage

The worker processes poster generation requests with customization data including:
- Course information and scorecard data
- Color scheme preferences
- Poster dimensions and layout options

## Security

- Service account keys are excluded from version control
- Sensitive configuration should be managed through environment variables in production

## License

ISC

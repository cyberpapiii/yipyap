# Icon Generation

The app now uses `/static/icon.svg` as the source icon.

## To generate PNG icons:

### Option 1: Use RealFaviconGenerator (Recommended)
1. Go to https://realfavicongenerator.net/
2. Upload `/static/icon.svg`
3. Download the generated icons
4. Place `apple-touch-icon.png` (180x180) in `/static/`
5. Place `favicon.png` (32x32) in `/static/`

### Option 2: Use sharp-cli
```bash
npm install -g sharp-cli
sharp -i static/icon.svg -o static/favicon.png resize 32 32
sharp -i static/icon.svg -o static/apple-touch-icon.png resize 180 180
```

### Option 3: Use ImageMagick
```bash
convert static/icon.svg -resize 32x32 static/favicon.png
convert static/icon.svg -resize 180x180 static/apple-touch-icon.png
```

## Current Icons Needed:
- [x] icon.svg (source - created)
- [ ] favicon.png (32x32)
- [ ] apple-touch-icon.png (180x180)

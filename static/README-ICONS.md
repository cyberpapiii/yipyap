# Icon Setup

YipYap uses SVG icons for optimal quality across all devices.

## Current Icon Files:
- [x] `app-icon.svg` - Main app icon (any size)
- [x] `apple-touch-icon.svg` - iOS home screen icon (180x180 viewport)
- [x] `favicon.svg` - Browser favicon (32x32 viewport)

## Icon Sources:
All icons are based on `/src/lib/assets/yipyap-ios-icon.svg` which features:
- Dark background (#101010)
- Red circle with white "Y"
- Green circle with white "Y"

## Why SVG?
- Scales perfectly on all devices
- No need to generate multiple PNG sizes
- Smaller file size
- iOS 12+ and all modern browsers support SVG icons

## If you need PNG versions:
Modern browsers and iOS handle SVG icons perfectly, but if you need PNGs:

```bash
# Using sharp-cli
npm install -g sharp-cli
sharp -i static/apple-touch-icon.svg -o static/apple-touch-icon.png resize 180 180
sharp -i static/favicon.svg -o static/favicon.png resize 32 32
```

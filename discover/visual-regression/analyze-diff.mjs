import fs from 'fs';
import path from 'path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

function analyzeDiff(imagePath1, imagePath2, outputDir = '/tmp/visual-regression') {
  if (!fs.existsSync(imagePath1) || !fs.existsSync(imagePath2)) {
    console.error('Error: One or both image files not found');
    process.exit(1);
  }

  const img1 = PNG.sync.read(fs.readFileSync(imagePath1));
  const img2 = PNG.sync.read(fs.readFileSync(imagePath2));

  const width = Math.max(img1.width, img2.width);
  const height = Math.max(img1.height, img2.height);

  const diffImg = new PNG({ width, height });
  const numDiffPixels = pixelmatch(
    img1.data,
    img2.data,
    diffImg.data,
    width,
    height,
    { threshold: 0.1 }
  );

  const totalPixels = width * height;
  const matchPercentage = ((totalPixels - numDiffPixels) / totalPixels * 100).toFixed(2);

  // Identify diff regions using connected components
  const diffRegions = findDiffRegions(diffImg.data, width, height);

  // Generate heatmap
  const heatmapPath = path.join(outputDir, 'heatmap.png');
  generateHeatmap(diffImg.data, width, height, heatmapPath);

  // Save diff image
  const diffPath = path.join(outputDir, 'diff-analysis.png');
  fs.writeFileSync(diffPath, PNG.sync.write(diffImg));

  console.log(`\n=== Diff Analysis ===`);
  console.log(`Image 1: ${imagePath1} (${img1.width}x${img1.height})`);
  console.log(`Image 2: ${imagePath2} (${img2.width}x${img2.height})`);
  console.log(`Diff pixels: ${numDiffPixels}/${totalPixels}`);
  console.log(`Match: ${matchPercentage}%`);
  console.log(`Diff regions found: ${diffRegions.length}`);
  console.log(`\nTop diff regions:`);
  
  diffRegions.slice(0, 10).forEach((region, i) => {
    console.log(`  ${i + 1}. (${region.x},${region.y}) ${region.width}x${region.height} - ${region.pixels} pixels`);
  });

  console.log(`\nDiff image: ${diffPath}`);
  console.log(`Heatmap: ${heatmapPath}`);

  return {
    matchPercentage: parseFloat(matchPercentage),
    diffPixels: numDiffPixels,
    totalPixels,
    diffRegions,
    diffImagePath: diffPath,
    heatmapPath,
  };
}

function findDiffRegions(diffData, width, height) {
  const visited = new Uint8Array(width * height);
  const regions = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (diffData[idx] > 0 && !visited[y * width + x]) {
        const region = floodFill(diffData, visited, width, height, x, y);
        if (region.pixels > 10) { // Filter noise
          regions.push(region);
        }
      }
    }
  }

  return regions.sort((a, b) => b.pixels - a.pixels);
}

function floodFill(diffData, visited, width, height, startX, startY) {
  const stack = [[startX, startY]];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  let pixels = 0;

  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    
    const idx = y * width + x;
    if (visited[idx]) continue;
    
    const pixelIdx = idx * 4;
    if (diffData[pixelIdx] === 0) continue;

    visited[idx] = 1;
    pixels++;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    pixels,
  };
}

function generateHeatmap(diffData, width, height, outputPath) {
  const heatmap = new PNG({ width, height });
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = srcIdx;
      
      const intensity = diffData[srcIdx] / 255; // Red channel indicates diff
      
      if (intensity > 0) {
        // Heatmap: blue (low) -> green -> yellow -> red (high)
        let r, g, b;
        if (intensity < 0.25) {
          r = 0; g = intensity * 4 * 255; b = 255;
        } else if (intensity < 0.5) {
          r = 0; g = 255; b = (1 - (intensity - 0.25) * 4) * 255;
        } else if (intensity < 0.75) {
          r = (intensity - 0.5) * 4 * 255; g = 255; b = 0;
        } else {
          r = 255; g = (1 - (intensity - 0.75) * 4) * 255; b = 0;
        }
        
        heatmap.data[dstIdx] = r;
        heatmap.data[dstIdx + 1] = g;
        heatmap.data[dstIdx + 2] = b;
        heatmap.data[dstIdx + 3] = Math.round(intensity * 200 + 55);
      } else {
        heatmap.data[dstIdx] = 0;
        heatmap.data[dstIdx + 1] = 0;
        heatmap.data[dstIdx + 2] = 0;
        heatmap.data[dstIdx + 3] = 0;
      }
    }
  }
  
  fs.writeFileSync(outputPath, PNG.sync.write(heatmap));
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node analyze-diff.mjs <image1.png> <image2.png> [outputDir]');
    process.exit(1);
  }

  analyzeDiff(args[0], args[1], args[2]);
}

export { analyzeDiff, findDiffRegions, generateHeatmap };

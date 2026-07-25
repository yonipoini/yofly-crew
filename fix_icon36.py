from PIL import Image, ImageFilter, ImageDraw
import sys

# Increase recursion depth for flood fill just in case
sys.setrecursionlimit(2000000)

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')

# 1. Scale to 1.30x to ensure wings fit, but leaves massive white borders
scale = 1.30
new_size = int(1024 * scale) # 1331
scaled = img.resize((new_size, new_size), Image.Resampling.LANCZOS)
left = (new_size - 1024) // 2
top = (new_size - 1024) // 2
cropped = scaled.crop((left, top, left + 1024, top + 1024))

clean = cropped.copy()
pixels = clean.load()
bg_color = (22, 18, 30, 255)

# 2. Simple iterative flood fill algorithm to find all white/grey pixels
# starting from the 4 corners.
# We consider a pixel "background" if it's brighter than the dark purple (e.g. r, g, b > 35)
stack = [(0, 0), (1023, 0), (0, 1023), (1023, 1023)]
visited = set(stack)

while stack:
    x, y = stack.pop()
    
    r, g, b, a = pixels[x, y]
    # The dark purple background is around 29, 25, 50. 
    # White/grey anti-aliased edge goes from 255 down to maybe 40.
    if r > 35 or g > 35 or b > 35:
        pixels[x, y] = bg_color
        
        # Add neighbors
        for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < 1024 and 0 <= ny < 1024:
                if (nx, ny) not in visited:
                    visited.add((nx, ny))
                    stack.append((nx, ny))

# 3. The boundary between (29, 25, 50) and (22, 18, 30) will be a perfectly shaped squircle seam.
# We blur the clean image to blend the seam perfectly.
blurred = clean.copy().filter(ImageFilter.GaussianBlur(30))

# 4. We composite the clean image onto the blurred image using a mask that protects the wings.
# The wings are at y=512, x=89 to 935.
# We can use a perfectly fitted rectangle to protect the wings and glow!
mask = Image.new('L', (1024, 1024), 0)
draw = ImageDraw.Draw(mask)
# Protect the center logo and wings perfectly. 
# This rectangle covers x=70 to 954, and y=250 to 774.
draw.rectangle((70, 250, 954, 774), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(25))

final = Image.composite(clean, blurred, mask)

final.save('assets/app-icon-square-v21.png')
final.save('assets/app-icon-square.png')
final.save('assets/icon.png')
final.save('assets/splash-icon.png')
print("Successfully generated v21 using Flood Fill!")

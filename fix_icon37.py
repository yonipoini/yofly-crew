from PIL import Image, ImageFilter, ImageDraw
import sys

sys.setrecursionlimit(2000000)
img = Image.open('assets/android-icon-foreground.png').convert('RGBA')

scale = 1.30
new_size = int(1024 * scale) 
scaled = img.resize((new_size, new_size), Image.Resampling.LANCZOS)
left = (new_size - 1024) // 2
top = (new_size - 1024) // 2
cropped = scaled.crop((left, top, left + 1024, top + 1024))

clean = cropped.copy()
pixels = clean.load()
bg_color = (22, 18, 30, 255)

# 2. Flood fill
stack = [(0, 0), (1023, 0), (0, 1023), (1023, 1023)]
visited = set(stack)

while stack:
    x, y = stack.pop()
    
    r, g, b, a = pixels[x, y]
    # The white background and grey edge are neutral: r ≈ g ≈ b.
    # The dark purple background is heavily skewed blue: r=29, b=50.
    # So if the difference between blue and red is small, it's the grey/white background!
    # Let's use b - r < 15 as the condition to keep flooding.
    # We also keep flooding if it's very bright (just in case).
    is_neutral = abs(int(b) - int(r)) < 18 and abs(int(g) - int(r)) < 18
    is_bright = r > 200 and g > 200 and b > 200
    
    if is_neutral or is_bright:
        pixels[x, y] = bg_color
        
        for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < 1024 and 0 <= ny < 1024:
                if (nx, ny) not in visited:
                    visited.add((nx, ny))
                    stack.append((nx, ny))

# 3. Blur the cleaned image to blend the flood-fill seam
blurred = clean.copy().filter(ImageFilter.GaussianBlur(15))

# 4. Mask the center to protect wings from being blurred
mask = Image.new('L', (1024, 1024), 0)
draw = ImageDraw.Draw(mask)
# Box safely around the wings and glow
draw.rectangle((60, 150, 964, 874), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(15))

final = Image.composite(clean, blurred, mask)

final.save('assets/app-icon-square-v22.png')
final.save('assets/app-icon-square.png')
final.save('assets/icon.png')
final.save('assets/splash-icon.png')
print("Successfully generated v22 using smart color flood fill!")
